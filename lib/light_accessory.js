const BaseAccessory = require('./base_accessory')

const helpers = require('./helpers')
const util = require('util')

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

const COLOR_MODES = ['color', 'colour'];

class LightAccessory extends BaseAccessory {

    static defaultBrightness = 100;
    static defaultSaturation = 100;
    static defaultHue = 359;

    constructor(platform, homebridgeAccessory, deviceConfig) {

        ({Accessory, Characteristic, Service} = platform.api.hap);

        super(
            platform,
            homebridgeAccessory,
            deviceConfig,
            Accessory.Categories.LIGHTBULB
        );

        this.log.debug('[%s] deviceConfig: %s', this.deviceConfig.name, util.inspect(this.deviceConfig))

        this.log.debug('[%s] Enabled "On"', this.deviceConfig.name)
        this.service.getCharacteristic(Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));

        if (this.supports(Characteristic.Brightness)) {
            this.log.debug('[%s] Enabled "Brightness"', this.deviceConfig.name)
            this.service.getCharacteristic(Characteristic.Brightness)
                .on('get', this.getBrightness.bind(this))
                .on('set', this.setBrightness.bind(this));
        } else if (this.service.getCharacteristic(Characteristic.Brightness)) {
            this.log.debug('[%s] Removed "Brightness"', this.deviceConfig.name)
            this.service.removeCharacteristic(this.service.getCharacteristic(Characteristic.Brightness))
        }

        if (this.supports(Characteristic.Saturation) && this.supports(Characteristic.Hue)) {
            this.log.debug('[%s] Enabled "Saturation", "Hue"', this.deviceConfig.name)
            this.service.getCharacteristic(Characteristic.Saturation)
                .on('get', this.getSaturation.bind(this))
                .on('set', this.setSaturation.bind(this));

            this.service.getCharacteristic(Characteristic.Hue)
                .on('get', this.getHue.bind(this))
                .on('set', this.setHue.bind(this));
        } else if (this.service.getCharacteristic(Characteristic.Saturation) || this.service.getCharacteristic(Characteristic.Hue)) {
            this.log.debug('[%s] Removed "Saturation", "Hue"', this.deviceConfig.name)
            this.service.removeCharacteristic(this.service.getCharacteristic(Characteristic.Saturation))
            this.service.removeCharacteristic(this.service.getCharacteristic(Characteristic.Hue))
        }

        // if(this.supports(Characteristic.ColorTemperature)){
        //     this.log.debug('[%s] Enabled "ColorTemperature"', this.deviceConfig.name)
        //     this.service.getCharacteristic(Characteristic.ColorTemperature)
        //         .on('get', this.getColorTemperature.bind(this))
        //         .on('set', this.setColorTemperature.bind(this));
        // }
    }

    supports(characteristic) {
        switch (characteristic) {
            case Characteristic.On:
                return helpers.objectHasKeys(this.deviceConfig.data, 'state')
            case Characteristic.Brightness:
                return helpers.objectHasKeys(this.deviceConfig.data, 'brightness') ||
                    helpers.objectHasKeys(this.deviceConfig.data, 'color', 'brightness')
            case Characteristic.Saturation:
                return COLOR_MODES.includes(this.deviceConfig.data.color_mode);
            case Characteristic.Hue:
                return COLOR_MODES.includes(this.deviceConfig.data.color_mode);
            case Characteristic.ColorTemperature:
                return false //helpers.objectHasKeys(this.deviceConfig.data, 'color_temp')
            default:
                return false;
        }
    }

    getOn(callback) {
        // Retrieve state from cache
        if (this.hasValidCache()) {
            callback(null, this.getCachedState(Characteristic.On));
        } else {
            // Retrieve device state from Tuya Web API
            this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
                this.log.debug('[GET][%s] Characteristic.On: %s', this.homebridgeAccessory.displayName, data.state);
                this.updateOn(data, callback);
            }).catch((error) => {
                this.log.error('[GET][%s] Characteristic.On Error: %s', this.homebridgeAccessory.displayName, error);
                this.invalidateCache();
                callback(error);
            });
        }
    }

    setOn(isOn, callback) {
        // Set device state in Tuya Web API
        const value = isOn ? 1 : 0;

        this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'turnOnOff', {value}).then(() => {
            this.log.debug('[SET][%s] Characteristic.On: %s %s', this.homebridgeAccessory.displayName, isOn, value);
            this.setCachedState(Characteristic.On, isOn);
            callback();
        }).catch((error) => {
            this.log.error('[SET][%s] Characteristic.On Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
        });
    }

    updateOn(data, callback) {
        if (data.state) {
            const isOn = (String(data.state) === 'true');
            this.setCharacteristic(Characteristic.On, isOn, !callback)
            callback && callback(null, isOn)
        }
    }

    getBrightness(callback) {
        if (this.hasValidCache()) {
            callback(null, this.getCachedState(Characteristic.Brightness));
        } else {
            // Retrieve device state from Tuya Web API
            this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
                // data.brightness only valid for color_mode!=color > https://github.com/PaulAnnekov/tuyaha/blob/master/tuyaha/devices/light.py
                // however, according to local tuya app, calculation for color_mode=color is still incorrect (even more so in lower range)

                this.log.debug('[GET][%s] Characteristic.Brightness: %s\%', this.homebridgeAccessory.displayName, data.brightness);
                this.updateBrightness(data, callback);
            }).catch((error) => {
                this.log.error('[GET][%s] Characteristic.Brightness Error: %s', this.homebridgeAccessory.displayName, error);
                this.invalidateCache();
                callback(error);
            });
        }
    }

    setBrightness(percentage, callback) {
        // NOTE: For some strange reason, the set value for brightness is in percentage
        const value = percentage; // 0-100

        // Set device state in Tuya Web API
        this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'brightnessSet', {value}).then(() => {
            this.log.debug('[SET][%s] Characteristic.Brightness: %s percent', this.homebridgeAccessory.displayName, percentage);
            this.setCachedState(Characteristic.Brightness, percentage);
            callback();
        }).catch((error) => {
            this.log.error('[SET][%s] Characteristic.Brightness Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
        });
    }

    updateBrightness(data, callback) {
        if (data.brightness || data.color.brightness) {
            let percentage;

            if (data.color && data.color.brightness) {
                percentage = Number(data.color.brightness); // 0-100
            } else {
                percentage = Math.floor(Number(data.brightness) / 255 * 100);  // 0-255 -> 0-100
            }

            this.setCharacteristic(Characteristic.Brightness, percentage, !callback)
            callback && callback(null, percentage)
        }
    }

    getSaturation(callback) {
        // Retrieve state from cache
        if (this.hasValidCache()) {
            callback(null, this.getCachedState(Characteristic.Saturation));
        } else {
            // Retrieve device state from Tuya Web API
            this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
                if (data.color) {
                    this.log.debug('[GET][%s] Characteristic.Saturation: %s', this.homebridgeAccessory.displayName, data.color.saturation);
                    this.updateSaturation(data, callback)
                    this.updateHue(data);
                } else {
                    callback(null, null);
                }
            }).catch((error) => {
                this.log.error('[GET][%s] Characteristic.Saturation Error: %s', this.homebridgeAccessory.displayName, error);
                this.invalidateCache();
                callback(error);
            });
        }
    }

    setSaturation(percentage, callback) {
        let color = {};

        const cachedBrightness = this.getCachedState(Characteristic.Brightness);
        const cachedHue = this.getCachedState(Characteristic.Hue);

        color.brightness = cachedBrightness ? cachedBrightness : LightAccessory.defaultBrightness;
        color.saturation = percentage;
        color.hue = cachedHue ? cachedHue : LightAccessory.defaultHue;

        this.setColor(color, callback)
    }

    updateSaturation(data, callback) {
        if (data.color && data.color.saturation) {
            let percentage;

            if (COLOR_MODES.includes(this.deviceConfig.data.color_mode) && Object.hasOwnProperty(data.color, 'saturation')) {
                percentage = data.color.saturation; // 0-100
            } else {
                percentage = Math.floor(data.saturation / 255 * 100);  // 0-255 -> 0-100
            }

            this.setCharacteristic(Characteristic.Saturation)

            this.setCachedState(Characteristic.Saturation, percentage, !callback)
            callback && callback(null, percentage)
        }
    }

    getHue(callback) {
        // Retrieve state from cache
        if (this.hasValidCache()) {
            callback(null, this.getCachedState(Characteristic.Hue));
        } else {
            // Retrieve device state from Tuya Web API
            this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
                if (data.color) {
                    this.log.debug('[GET][%s] Characteristic.Hue: %s', this.homebridgeAccessory.displayName, data.color.hue);
                    this.updateHue(data, callback);
                    this.updateSaturation(data);
                } else {
                    callback(null, null);
                }
            }).catch((error) => {
                this.log.error('[GET][%s] Characteristic.Hue Error: %s', this.homebridgeAccessory.displayName, error);
                this.invalidateCache();
                callback(error);
            });
        }
    }

    setHue(hue, callback) {
        let color = {};

        const cachedBrightness = this.getCachedState(Characteristic.Brightness);
        const cachedSaturation = this.getCachedState(Characteristic.Saturation);

        color.brightness = cachedBrightness ? cachedBrightness : LightAccessory.defaultBrightness;
        color.saturation = cachedSaturation ? cachedSaturation : LightAccessory.defaultSaturation;
        color.hue = hue;

        this.setColor(color, callback);
    }

    updateHue(data, callback) {
        if (data.color && data.color.hue) {
            let hue;

            if (COLOR_MODES.includes(this.deviceConfig.data.color_mode) && Object.hasOwnProperty(data.color, 'hue')) {
                hue = data.color.hue; // 0-100
            } else {
                hue = data.hue
            }
            this.setCharacteristic(Characteristic.Hue, hue, !callback)
            callback && callback(null, hue)
        }
    }

    getColorTemperature(callback) {

    }

    setColorTemperature(temperature, callback) {

    }

    updateColorTemperature(data, callback) {

    }

    /**
     * Update the colors to the specified homekit values
     * @param color in HomeKit format
     * @param callback
     */
    setColor(color, callback) {
        this.log.debug(
            '[SET][%s] Reported: Brightness - %s, Hue - %s, Saturation - %s',
            this.homebridgeAccessory.displayName,
            color.brightness,
            color.hue,
            color.saturation
        );
        var tuyaColors = {
            brightness: color.brightness,
            hue: Math.round(color.hue),
            saturation: color.saturation / 100
        };

        this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'colorSet', {color: tuyaColors}).then(() => {
            this.log.debug(
                '[SET][%s] Color: Brightness - %s, Hue - %s, Saturation - %s',
                this.homebridgeAccessory.displayName,
                color.brightness,
                color.hue,
                color.saturation
            );
            this.setCachedState(Characteristic.Brightness, color.brightness);
            this.setCachedState(Characteristic.Saturation, color.saturation);
            this.setCachedState(Characteristic.Hue, color.hue);
            callback();
        }).catch((error) => {
            this.log.error('[SET][%s] Color Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
        });
    }

    updateState(data) {
        // Update device type specific state
        this.log.debug('[UPDATING][%s]:', this.homebridgeAccessory.displayName, data);

        this.updateOn(data);
        this.updateBrightness(data);
        this.updateSaturation(data);
        this.updateHue(data);
        this.updateColorTemperature(data);
    }
}

module.exports = LightAccessory;
