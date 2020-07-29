import {API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, Service} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {TuyaDevice, TuyaDeviceType, TuyaDeviceTypes, TuyaPlatforms, TuyaWebApi} from './TuyaWebApi';
import {
  BaseAccessory,
  DimmerAccessory,
  FanAccessory,
  LightAccessory,
  OutletAccessory,
  SceneAccessory,
  SwitchAccessory,
} from './accessories';
import {TuyaDeviceDefaults, TuyaWebConfig} from './config';

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
    private readonly pollingInterval?: number;

    public readonly tuyaWebApi!: TuyaWebApi;

    private failedToInitAccessories: Map<TuyaDeviceType, string[]> = new Map();

    constructor(
        public readonly log: Logger,
        public readonly config: TuyaWebConfig,
        public readonly api: API,
    ) {
      this.log.debug('Finished initializing platform:', this.config.name);

      if (!config || !config.options) {
        this.log.info('No options found in configuration file, disabling plugin.');
        return;
      }
      const options = config.options;

      if (options.username === undefined || options.password === undefined || options.countryCode === undefined) {
        this.log.error('Missing required config parameter.');
        return;
      }

      if (options.platform !== undefined && !TuyaPlatforms.includes(options.platform)) {
        this.log.error('Invalid platform provided, received %s but must be one of %s', options.platform, TuyaPlatforms);
      }

      // Set cloud polling interval
      this.pollingInterval = config.options.pollingInterval;

      // Create Tuya Web API instance
      this.tuyaWebApi = new TuyaWebApi(
        options.username,
        options.password,
        options.countryCode,
        options.platform,
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
    public registerPlatformAccessory(accessory: PlatformAccessory): void {
      this.log.debug('Register Platform Accessory (%s)', accessory.displayName);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.set(accessory.UUID, accessory);
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
      const deviceType: TuyaDeviceType = device.dev_type || 'switch';
      const uuid = this.api.hap.uuid.generate(device.id);
      const homebridgeAccessory = this.accessories.get(uuid)!;

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

    async discoverDevices(): Promise<void> {
      let devices = await this.tuyaWebApi.discoverDevices() || [];

      // Is device type overruled in config defaults?
      const parsedDefaults = this.parseDefaultsForDevices(devices);
      for (const defaults of parsedDefaults) {
        defaults.device.dev_type = defaults.device_type;
        this.log.info('Device type for "%s" is overruled in config to: "%s"', defaults.device.name, defaults.device.dev_type);
      }

      const whitelistedSceneIds = this.getWhitelistedSceneIds(devices);
      devices = devices.filter(d => d.dev_type !== 'scene' || whitelistedSceneIds.includes(d.id));

      // loop over the discovered devices and register each one if it has not already been registered
      for (const device of devices) {
        this.addAccessory(device);
      }

      await this.refreshDeviceStates(devices);
    }

    /**
     * Returns a validated set of defaults and their devices for which the type will need to be overridden.
     * @param devices
     * @private
     */
    private parseDefaultsForDevices(devices: TuyaDevice[]): Array<TuyaDeviceDefaults & { device: TuyaDevice }> {
      const defaults = this.config.defaults;

      if (!defaults) {
        return [];
      }

      const parsedDefaults: Array<TuyaDeviceDefaults & { device: TuyaDevice }> = [];
      for (const configuredDefault of defaults as Partial<TuyaDeviceDefaults>[]) {
        const device = devices.find(device => device.id === configuredDefault.id);
        if (!device) {
          this.log.warn('Added default for id: "%s" which is not a valid device-id.', configuredDefault.id);
          continue;
        }

        if (configuredDefault.device_type === undefined || !TuyaDeviceTypes.includes(configuredDefault.device_type)) {
          this.log.warn(
            'Added defaults for id: "%s" - device-type "%s" is not a valid device-type.', device.id, configuredDefault.device_type,
          );
          continue;
        }

        parsedDefaults.push({...(configuredDefault as TuyaDeviceDefaults), device});
      }

      return parsedDefaults;
    }

    /**
     * Returns a list of all whitelisted scene Ids.
     * @param devices
     * @private
     */
    private getWhitelistedSceneIds(devices: TuyaDevice[]): string[] {
      if (this.config.scenes === false || this.config.scenes === undefined) {
        return [];
      }

      const scenes: { [key: string]: string } = devices.filter(d => d.dev_type === 'scene').reduce((devices, device) => {
        devices[device.id] = device.name;
        return devices;
      }, {});

      if (this.config.scenes === true) {
        return Object.keys(scenes);
      }

      const whitelistedSceneIds: string[] = [];

      for (const toWhitelistSceneId of this.config.scenes as string[]) {
        if (Object.keys(scenes).includes(toWhitelistSceneId)) {
          whitelistedSceneIds.push(toWhitelistSceneId);
          continue;
        }

        if (Object.values(scenes).includes(toWhitelistSceneId)) {
          whitelistedSceneIds.push(Object.keys(scenes).find(key => scenes[key] === toWhitelistSceneId)!);
          continue;
        }

        this.log.warn('Tried whitelisting non-existing scene %s', toWhitelistSceneId);
      }


      return whitelistedSceneIds;
    }

    public get platformAccessory(): typeof PlatformAccessory {
      return this.api.platformAccessory;
    }

    public get generateUUID(): (BinaryLike) => string {
      return this.api.hap.uuid.generate;
    }

}
