import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {TuyaDevice, TuyaDeviceType, TuyaWebApi} from './TuyaWebApi';
import {
  BaseAccessory,
  DimmerAccessory,
  FanAccessory,
  LightAccessory,
  OutletAccessory,
  SceneAccessory,
  SwitchAccessory,
} from './accessories';

export type HomebridgeAccessory<DeviceConfig extends TuyaDevice> =
    PlatformAccessory
    & { controller?: BaseAccessory<DeviceConfig> }

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TuyaWebPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly accessories: Map<string, HomebridgeAccessory<any>> = new Map();

    // Cloud polling interval in seconds
    private pollingInterval?: number;

    public readonly tuyaWebApi!: TuyaWebApi;

    private failedToInitAccessories: Map<TuyaDeviceType, string[]> = new Map();

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
      this.log.debug('Finished initializing platform:', this.config.name);

      if (!config || !config.options) {
        this.log.info('No config found, disabling plugin.');
        return;
      }

      // Set cloud polling interval
      this.pollingInterval = this.config.options.pollingInterval;

      // Create Tuya Web API instance
      this.tuyaWebApi = new TuyaWebApi(
        this.config.options.username,
        this.config.options.password,
        this.config.options.countryCode,
        this.config.options.platform,
        this.log,
      );

      // When this event is fired it means Homebridge has restored all cached accessories from disk.
      // Dynamic Platform plugins should only register new accessories after this event was fired,
      // in order to ensure they weren't added to homebridge already. This event can also be used
      // to start discovery of new accessories.
      this.api.on('didFinishLaunching', async () => {
        await this.tuyaWebApi.getOrRefreshToken();
        // run the method to discover / register your devices as accessories
        await this.discoverDevices();

        if (this.pollingInterval) {
                this.log?.info('Enable cloud polling with interval %ss', this.pollingInterval);
                // Set interval for refreshing device states
                setInterval(() => {
                  this.refreshDeviceStates().catch((error) => {
                    this.log.error(error.message);
                  });
                }, this.pollingInterval * 1000);
        }
      });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    public configureAccessory(accessory: PlatformAccessory): void {
      this.log.info('Loading accessory from cache:', accessory.displayName);

      // add the restored accessory to the accessories cache so we can track if it has already been registered
      this.accessories.set(accessory.UUID, accessory);
    }

    public removeAccessory(accessory: PlatformAccessory): void {
      this.log.info('Removing accessory:', accessory.displayName);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

      this.accessories.delete(accessory.UUID);
    }

    // Called from device classes
    public registerPlatformAccessory(platformAccessory): void {
      this.log.debug('Register Platform Accessory (%s)', platformAccessory.displayName);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
    }

    private async refreshDeviceStates(devices?: TuyaDevice[]): Promise<void> {
      devices = devices || await this.tuyaWebApi.getAllDeviceStates();
      if (!devices) {
        return;
      }

      // Refresh device states
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.id);
        const homebridgeAccessory = this.accessories.get(uuid);
        if (homebridgeAccessory) {
                homebridgeAccessory.controller?.updateAccessory(device);
        } else if (!this.failedToInitAccessories.get(device.dev_type)?.includes(uuid)) {
          this.log.error('Could not find accessory in dictionary (%s)', uuid);
        }
      }
    }

    private addAccessory(device: TuyaDevice): void {
      let deviceType: TuyaDeviceType = device.dev_type || 'switch';
      const uuid = this.api.hap.uuid.generate(device.id);
      const homebridgeAccessory = this.accessories.get(uuid)!;

      // Is device type overruled in config defaults?
      if (this.config.defaults) {
        for (const defaults of this.config.defaults) {
          if (device.id === defaults.id) {
            deviceType = defaults.device_type || deviceType;
            this.log.info('Device type is overruled in config to: %s', deviceType);
          }
        }
      }

      // Construct new accessory
      /* eslint-disable @typescript-eslint/no-explicit-any */
      switch (deviceType) {
        case 'dimmer':
          new DimmerAccessory(this, homebridgeAccessory, device as any);
          break;
        case 'fan':
          new FanAccessory(this, homebridgeAccessory, device as any);
          break;
        case 'light':
          new LightAccessory(this, homebridgeAccessory, device as any);
          break;
        case 'outlet':
          new OutletAccessory(this, homebridgeAccessory, device as any);
          break;
        case 'scene':
          new SceneAccessory(this, homebridgeAccessory, device as any);
          break;
        case 'switch':
          new SwitchAccessory(this, homebridgeAccessory, device as any);
          break;

        default:
          if (!this.failedToInitAccessories.get(deviceType)) {
            this.log.warn('Could not init class for device type [%s]', deviceType);
            this.failedToInitAccessories.set(deviceType, []);
          }
          this.failedToInitAccessories.set(deviceType, [uuid, ...this.failedToInitAccessories.get(deviceType)!]);
          break;
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices(): Promise<void> {
      const devices = await this.tuyaWebApi.discoverDevices();

      // loop over the discovered devices and register each one if it has not already been registered
      for (const device of devices || []) {
        this.addAccessory(device);
      }

      this.refreshDeviceStates(devices);
    }

    public get platformAccessory(): typeof PlatformAccessory {
      return this.api.platformAccessory;
    }

    public get generateUUID(): (BinaryLike) => string {
      return this.api.hap.uuid.generate;
    }

}
