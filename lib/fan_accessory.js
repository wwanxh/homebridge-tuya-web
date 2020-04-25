const TuyaWebApi = require('./tuyawebapi');
const BaseAccessory = require('./base_accessory')

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class FanAccessory extends BaseAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {
    console.log(deviceConfig);


    ({Accessory, Characteristic, Service} = platform.api.hap);

    super(
        platform,
        homebridgeAccessory,
        deviceConfig,
        Accessory.Categories.FAN
    );

    // Characteristic.Active
    this.service.getCharacteristic(Characteristic.Active)
        .on('get', (callback) => {
          // Retrieve state from cache
          if (this.hasValidCache()) {
            callback(null, this.getCachedState(Characteristic.Active));
          } else {
            // Retrieve device state from Tuya Web API
            this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
              var isOn = data.state === 'true' ? 1 : 0;
              this.log.debug('[GET][%s] Characteristic.Active: %s', this.homebridgeAccessory.displayName, isOn);
              this.setCachedState(Characteristic.On, isOn);
              callback(null, data.state);
            }).catch((error) => {
              this.log.error('[GET][%s] Characteristic.Active Error: %s', this.homebridgeAccessory.displayName, error);
              this.invalidateCache();
              callback(error);
            });
          }
        })
        .on('set', (isOn, callback) => {
          // Set device state in Tuya Web API
          const value = isOn ? 1 : 0;

          this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'turnOnOff', {value: value}).then(() => {
            this.log.debug('[SET][%s] Characteristic.Active: %s %s', this.homebridgeAccessory.displayName, isOn, value);
            this.setCachedState(Characteristic.Active, isOn);
            callback();
          }).catch((error) => {
            this.log.error('[SET][%s] Characteristic.Active Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
          });
        });

    if(deviceConfig.data && deviceConfig.data.speed_level) {
      var maxSpeedLevel = deviceConfig.data.speed_level;
      var stepSize = Math.floor(100/maxSpeedLevel);
      // Characteristic.RotationSpeed
      this.service.getCharacteristic(Characteristic.RotationSpeed)
          .setProps({
            minStep: stepSize
          })
          .on('get', (callback) => {
            // Retrieve state from cache
            if (this.hasValidCache()) {
              callback(null, this.getCachedState(Characteristic.RotationSpeed));
            } else {
              // Retrieve device state from Tuya Web API
              this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
                var floatValue = Number(data.speed) * stepSize;
                this.log.debug('[GET][%s] Characteristic.RotationSpeed: %s', this.homebridgeAccessory.displayName, floatValue);
                this.setCachedState(Characteristic.RotationSpeed, floatValue);
                callback(null, floatValue);
              }).catch((error) => {
                this.log.error('[GET][%s] Characteristic.RotationSpeed Error: %s', this.homebridgeAccessory.displayName, error);
                this.invalidateCache();
                callback(error);
              });
            }
          })
          .on('set', (floatValue, callback) => {
            // Set device state in Tuya Web API
            const value = Math.round(floatValue / stepSize)

            this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'windSpeedSet', {value: value}).then(() => {
              this.log.debug('[SET][%s] Characteristic.RotationSpeed: %s %s', this.homebridgeAccessory.displayName, floatValue, value);
              this.setCachedState(Characteristic.RotationSpeed, value);
              callback();
            }).catch((error) => {
              this.log.error('[SET][%s] Characteristic.RotationSpeed Error: %s', this.homebridgeAccessory.displayName, error);
              this.invalidateCache();
              callback(error);
            });
          });
    }
  }

  updateState(data) {
    // Update device type specific state
    this.log.debug('[UPDATING][%s]:', this.homebridgeAccessory.displayName, data);

    if (data.state !== undefined) {
      const isOn = (data.state === 'true');
      this.service
        .getCharacteristic(Characteristic.Active)
        .updateValue(isOn ? 1 : 0);
      this.setCachedState(Characteristic.Active, isOn ? 1 : 0);
    }

    if (data.speed_level && data.speed) {
      var maxSpeedLevel = data.speed_level;
      var stepSize = Math.floor(100/maxSpeedLevel);
      var value = Number(data.speed) * stepSize
      this.service
          .getCharacteristic(Characteristic.RotationSpeed)
          .updateValue(value);
      this.setCachedState(Characteristic.RotationSpeed, value);
    }
  }
}

module.exports = FanAccessory;
