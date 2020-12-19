import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import {
  Categories,
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicValue,
  Logger,
  LogLevel,
  Nullable,
  Service,
  WithUUID,
} from "homebridge";
import debounce from "lodash.debounce";
import { PLUGIN_NAME } from "../settings";
import { inspect } from "util";
import { DebouncedPromise } from "../helpers/DebouncedPromise";
import { ErrorCallback, RatelimitError } from "../errors";
import { GeneralCharacteristic } from "./characteristics";
import {
  DeviceState,
  TuyaApiMethod,
  TuyaApiPayload,
  TuyaDevice,
} from "../api/response";
import { Cache } from "../helpers/cache";

export type CharacteristicConstructor = WithUUID<{
  new (): Characteristic;
}>;

type UpdateCallback = (
  data?: DeviceState,
  callback?: CharacteristicGetCallback
) => void;

export abstract class BaseAccessory {
  public readonly log: Logger;
  private readonly cache = new Cache();
  private readonly serviceType: WithUUID<typeof Service>;
  public readonly service?: Service;
  public readonly deviceId: string;
  private updateCallbackList: Map<
    CharacteristicConstructor,
    Nullable<UpdateCallback>
  > = new Map();

  /**
   * The characteristics that this device-type could theoretically support.
   */
  public abstract get accessorySupportedCharacteristics(): GeneralCharacteristic[];

  /**
   * The characteristics that this device-type is required to support.
   */
  public abstract get requiredCharacteristics(): GeneralCharacteristic[];

  /**
   * The characteristics that this device actually supports.
   */
  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    return this.accessorySupportedCharacteristics
      .filter((asc) => !this.requiredCharacteristics.includes(asc))
      .filter((asc) => asc.isSupportedByAccessory(this));
  }

  constructor(
    public readonly platform: TuyaWebPlatform,
    public readonly homebridgeAccessory: HomebridgeAccessory,
    public readonly deviceConfig: TuyaDevice,
    private readonly categoryType: Categories
  ) {
    this.log = platform.log;
    this.deviceId = deviceConfig.id;

    this.log.debug(
      "[%s] deviceConfig: %s",
      this.deviceConfig.name,
      inspect(this.deviceConfig)
    );

    this.validateConfigOverwrites(this.deviceConfig.config).forEach((error) =>
      this.error(error)
    );

    switch (categoryType) {
      case Categories.LIGHTBULB:
        this.serviceType = platform.Service.Lightbulb;
        break;
      case Categories.SWITCH:
        this.serviceType = platform.Service.Switch;
        break;
      case Categories.OUTLET:
        this.serviceType = platform.Service.Outlet;
        break;
      case Categories.FAN:
        this.serviceType = platform.Service.Fanv2;
        break;
      case Categories.THERMOSTAT:
        this.serviceType = platform.Service.Thermostat;
        break;
      default:
        this.serviceType = platform.Service.AccessoryInformation;
    }

    // Retrieve existing of create new Bridged Accessory
    if (this.homebridgeAccessory) {
      this.homebridgeAccessory.controller = this;
      if (!this.homebridgeAccessory.context.deviceId) {
        this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
      }
      this.log.info(
        "Existing Accessory found [Name: %s] [Tuya ID: %s] [HomeBridge ID: %s]",
        this.homebridgeAccessory.displayName,
        this.homebridgeAccessory.context.deviceId,
        this.homebridgeAccessory.UUID
      );
      this.homebridgeAccessory.displayName = this.deviceConfig.name;
    } else {
      this.homebridgeAccessory = new this.platform.platformAccessory(
        this.deviceConfig.name,
        this.platform.generateUUID(this.deviceConfig.id),
        categoryType
      );
      this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
      this.homebridgeAccessory.controller = this;
      this.log.info(
        "Created new Accessory [Name: %s] [Tuya ID: %s] [HomeBridge ID: %s]",
        this.homebridgeAccessory.displayName,
        this.homebridgeAccessory.context.deviceId,
        this.homebridgeAccessory.UUID
      );
      this.platform.registerPlatformAccessory(this.homebridgeAccessory);
    }

    // Create service
    this.service = this.homebridgeAccessory.getService(this.serviceType);
    if (!this.service) {
      this.log.debug("Creating New Service %s", this.deviceConfig.id);
      this.service = this.homebridgeAccessory.addService(
        this.serviceType,
        this.deviceConfig.name
      );
    }

    this.homebridgeAccessory.on("identify", this.onIdentify.bind(this));

    this.initializeCharacteristics();
    this.cleanupServices();
  }

  private get defaultCharacteristics(): CharacteristicConstructor[] {
    return [
      this.platform.Characteristic.Manufacturer,
      this.platform.Characteristic.Model,
      this.platform.Characteristic.Name,
      this.platform.Characteristic.SerialNumber,
    ];
  }

  private initializeCharacteristics(): void {
    const deviceSupportedCharacteristics = [
      ...this.requiredCharacteristics,
      ...this.deviceSupportedCharacteristics,
    ];
    deviceSupportedCharacteristics.forEach((gc) => new gc(this));

    const homekitCharacteristics = deviceSupportedCharacteristics.map(
      (gc) => gc.HomekitCharacteristic(this).UUID
    );

    this.service?.characteristics?.forEach((char) => {
      if (!homekitCharacteristics.includes(char.UUID)) {
        this.debug(`Characteristic ${char.displayName} not supported`);
        this.service?.removeCharacteristic(char);
      }
    });
  }

  private cleanupServices(): void {
    const outdatedServices: Service[] = [];
    this.homebridgeAccessory.services.forEach((service) => {
      if (
        ![
          this.service?.UUID,
          this.platform.Service.AccessoryInformation.UUID,
        ].includes(service.UUID)
      ) {
        this.info(
          `Removing superfluous service: ${
            service.displayName
          } (${service.characteristics.map((c) => c.displayName)})`
        );
        outdatedServices.push(service);
      }
    });
    outdatedServices.forEach((service) =>
      this.homebridgeAccessory.removeService(service)
    );
  }

  /**
   * Should validate and correct the supplied overwrite configuration for this device.
   * @returns A list of all errors in this config.
   */
  public validateConfigOverwrites(): string[] {
    return [];
  }

  public get name(): string {
    return this.homebridgeAccessory.displayName;
  }

  public setCharacteristic(
    characteristic: CharacteristicConstructor,
    value: Nullable<CharacteristicValue>,
    updateHomekit = false
  ) {
    updateHomekit &&
      this.service?.getCharacteristic(characteristic).updateValue(value);
  }

  public onIdentify(): void {
    this.log.info("[IDENTIFY] %s", this.name);
  }

  public cachedValue(always = false): Nullable<DeviceState> {
    return this.cache.get(always);
  }

  private debouncedDeviceStateRequest = debounce(
    this.resolveDeviceStateRequest,
    500,
    { maxWait: 1500 }
  );

  private debouncedDeviceStateRequestPromise?: DebouncedPromise<DeviceState>;

  public async resolveDeviceStateRequest() {
    const promise = this.debouncedDeviceStateRequestPromise;
    if (!promise) {
      this.error("Could not find base accessory promise.");
      return;
    }
    this.debug("Unsetting debouncedDeviceStateRequestPromise");
    this.debouncedDeviceStateRequestPromise = undefined;

    const cached = this.cache.get();
    if (cached !== null) {
      this.debug("Resolving resolveDeviceStateRequest from cache");
      return promise.resolve(cached);
    }

    try {
      const data = await this.platform.tuyaWebApi.getDeviceState(this.deviceId);
      this.debug("Resolving resolveDeviceStateRequest from remote");
      this.debug("Set device state request cache");
      this.cache.set(data);
      promise.resolve(data);
    } catch (error) {
      if (error instanceof RatelimitError) {
        this.debug("Renewing cache due to RateLimitError");
        const data = this.cache.get(true);
        if (data) {
          this.cache.renew();
          return promise.resolve(data);
        }
      }
      promise.reject(error);
    }
  }

  public async getDeviceState(): Promise<DeviceState> {
    this.debug("Requesting device state");
    if (!this.debouncedDeviceStateRequestPromise) {
      this.debug("Creating new debounced promise");
      this.debouncedDeviceStateRequestPromise = new DebouncedPromise();
    }

    this.debug("Triggering debouncedDeviceStateRequest");
    this.debouncedDeviceStateRequest();

    return this.debouncedDeviceStateRequestPromise.promise;
  }

  public async setDeviceState<Method extends TuyaApiMethod, T>(
    method: Method,
    payload: TuyaApiPayload<Method>,
    cache: T
  ): Promise<void> {
    this.cache.merge(cache);

    return this.platform.tuyaWebApi.setDeviceState(
      this.deviceId,
      method,
      payload
    );
  }

  public updateAccessory(device: TuyaDevice) {
    const setCharacteristic = (characteristic, value): void => {
      const char =
        accessoryInformationService.getCharacteristic(characteristic) ||
        accessoryInformationService.addCharacteristic(characteristic);
      if (char) {
        char.setValue(value);
      }
    };

    this.homebridgeAccessory.displayName = device.name;
    this.homebridgeAccessory._associatedHAPAccessory.displayName = device.name;
    const accessoryInformationService =
      this.homebridgeAccessory.getService(
        this.platform.Service.AccessoryInformation
      ) ||
      this.homebridgeAccessory.addService(
        this.platform.Service.AccessoryInformation
      );
    setCharacteristic(this.platform.Characteristic.Name, device.name);

    setCharacteristic(
      this.platform.Characteristic.SerialNumber,
      this.deviceConfig.id
    );
    setCharacteristic(this.platform.Characteristic.Manufacturer, PLUGIN_NAME);
    setCharacteristic(
      this.platform.Characteristic.Model,
      device.dev_type.charAt(0).toUpperCase() + device.dev_type.slice(1)
    );

    // Update device specific state
    this.updateState(device.data);
  }

  private updateState(data: DeviceState): void {
    this.cache.set(data);
    for (const [, callback] of this.updateCallbackList) {
      if (callback !== null) {
        callback(data);
      }
    }
  }

  public addUpdateCallback(
    char: CharacteristicConstructor,
    callback: UpdateCallback
  ) {
    this.updateCallbackList.set(char, callback);
  }

  public handleError(
    type: "SET" | "GET",
    callback: ErrorCallback
  ): ErrorCallback {
    return (error) => {
      this.error("[%s] %s", type, error.message);
      callback(error);
    };
  }

  private shortcutLog(
    logLevel: LogLevel,
    message: string,
    ...args: unknown[]
  ): void {
    this.log.log(logLevel, `[%s] - ${message}`, this.name, ...args);
  }

  protected debug(message: string, ...args: unknown[]): void {
    this.shortcutLog(LogLevel.DEBUG, message, ...args);
  }

  protected info(message: string, ...args: unknown[]): void {
    this.shortcutLog(LogLevel.INFO, message, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    this.shortcutLog(LogLevel.WARN, message, ...args);
  }

  protected error(message: string, ...args: unknown[]): void {
    this.shortcutLog(LogLevel.ERROR, message, ...args);
  }
}
