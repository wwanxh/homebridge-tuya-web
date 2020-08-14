import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {
  Categories,
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicValue,
  Logger,
  Nullable,
  Service,
  WithUUID,
} from 'homebridge';
import {TuyaDevice} from '../TuyaWebApi';
import {PLUGIN_NAME} from '../settings';
import {inspect} from 'util';

export type CharacteristicConstructor = WithUUID<{
    new(): Characteristic;
}>;

type UpdateCallback<DeviceConfig extends TuyaDevice> = (data?: DeviceConfig['data'], callback?: CharacteristicGetCallback) => void

class Cache {
    private state: Map<CharacteristicConstructor, { validUntil: number, value: Nullable<CharacteristicValue> }> = new Map();
    private _valid = false;

    public get valid(): boolean {
      return this._valid && this.state.size > 0;
    }

    public invalidate() {
      this._valid = false;
    }

    public set(char: CharacteristicConstructor, value: Nullable<CharacteristicValue>) {
      const validUntil = Cache.getCurrentEpoch() + 15;
      this.state.set(char, {
        validUntil,
        value,
      });
      this._valid = true;
    }

    public get(char: CharacteristicConstructor): Nullable<CharacteristicValue> {
      const cache = this.state.get(char);
      if (!this._valid || !cache || cache.validUntil < Cache.getCurrentEpoch()) {
        return null;
      }
      return cache.value;
    }

    private static getCurrentEpoch(): number {
      return Math.round((new Date()).getTime() / 1000);
    }
}

type ErrorCallback = (error: any) => void;

export abstract class BaseAccessory<DeviceConfig extends TuyaDevice = TuyaDevice> {
    public readonly log: Logger;
    private readonly cache = new Cache();
    private readonly serviceType: WithUUID<typeof Service>;
    public readonly service?: Service;
    public readonly deviceId: string;
    private updateCallbackList: Map<CharacteristicConstructor, Nullable<UpdateCallback<DeviceConfig>>> = new Map();

    constructor(
        public readonly platform: TuyaWebPlatform,
        public readonly homebridgeAccessory: HomebridgeAccessory<DeviceConfig>,
        public readonly deviceConfig: DeviceConfig,
        private readonly categoryType: Categories) {
      this.log = platform.log;
      this.deviceId = deviceConfig.id;

      this.log.debug('[%s] deviceConfig: %s', this.deviceConfig.name, inspect(this.deviceConfig));

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
          'Existing Accessory found [Name: %s] [Tuya ID: %s] [HomeBridge ID: %s]',
          this.homebridgeAccessory.displayName,
          this.homebridgeAccessory.context.deviceId,
          this.homebridgeAccessory.UUID);
        this.homebridgeAccessory.displayName = this.deviceConfig.name;
      } else {
        this.homebridgeAccessory = new this.platform.platformAccessory(
          this.deviceConfig.name,
          this.platform.generateUUID(this.deviceConfig.id),
          categoryType);
        this.homebridgeAccessory.context.deviceId = this.deviceConfig.id;
        this.homebridgeAccessory.controller = this;
        this.log.info('Created new Accessory [Name: %s] [Tuya ID: %s] [HomeBridge ID: %s]',
          this.homebridgeAccessory.displayName,
          this.homebridgeAccessory.context.deviceId,
          this.homebridgeAccessory.UUID);
        this.platform.registerPlatformAccessory(this.homebridgeAccessory);
      }

      // Create service
      this.service = this.homebridgeAccessory.getService(this.serviceType);
      if (this.service) {
        this.service.setCharacteristic(platform.Characteristic.Name, this.deviceConfig.name);
      } else {
        this.log.debug('Creating New Service %s', this.deviceConfig.id);
        this.service = this.homebridgeAccessory.addService(this.serviceType, this.deviceConfig.name);
      }

      this.homebridgeAccessory.on('identify', this.onIdentify.bind(this));
    }

    public get name(): string {
      return this.homebridgeAccessory.displayName;
    }

    public setCharacteristic(characteristic: CharacteristicConstructor, value: Nullable<CharacteristicValue>, updateHomekit = false) {
      updateHomekit && this.service?.getCharacteristic(characteristic).updateValue(value);
    }

    public invalidateCache(): void {
      this.cache.invalidate();
    }

    public getCachedState(char: CharacteristicConstructor): Nullable<CharacteristicValue> {
      return this.cache.get(char);
    }

    public setCachedState(char: CharacteristicConstructor, value: Nullable<CharacteristicValue>): void {
      return this.cache.set(char, value);
    }

    public onIdentify(): void {
      this.log.info('[IDENTIFY] %s', this.name);
    }

    public updateAccessory(device: DeviceConfig) {
      const setCharacteristic = (characteristic, value): void => {
        const char = accessoryInformationService.getCharacteristic(characteristic) ||
                accessoryInformationService.addCharacteristic(characteristic);
        if (char) {
          char.setValue(value);
        }
      };

      this.homebridgeAccessory.displayName = device.name;
      this.homebridgeAccessory._associatedHAPAccessory.displayName = device.name;
      const accessoryInformationService = (
        this.homebridgeAccessory.getService(this.platform.Service.AccessoryInformation) ||
            this.homebridgeAccessory.addService(this.platform.Service.AccessoryInformation));
      setCharacteristic(this.platform.Characteristic.Name, device.name);

      setCharacteristic(this.platform.Characteristic.SerialNumber, this.deviceConfig.id);
      setCharacteristic(this.platform.Characteristic.Manufacturer, PLUGIN_NAME);
      setCharacteristic(this.platform.Characteristic.Model, this.categoryType);

      // Update device specific state
      this.updateState(device.data);
    }

    private updateState(data: DeviceConfig['data']): void {
      for (const [, callback] of this.updateCallbackList) {
        if (callback !== null) {
          callback(data);
        }
      }
    }

    public addUpdateCallback(char: CharacteristicConstructor, callback: UpdateCallback<DeviceConfig>) {
      this.updateCallbackList.set(char, callback);
    }

    public handleError(type: 'SET' | 'GET', callback: ErrorCallback): ErrorCallback {
      return (error) => {
        this.log.error('[%s] %s', type, error.message);
        this.invalidateCache();
        callback(error);
      };
    }
}
