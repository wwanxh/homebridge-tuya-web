import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {MapRange} from '../../helpers/MapRange';
import {BaseAccessory} from '../BaseAccessory';

export type ColorTemperatureCharacteristicData = { color_temp: number }
type DeviceWithColorTemperatureCharacteristic = TuyaDevice<TuyaDeviceState & ColorTemperatureCharacteristicData>

// Homekit uses mired light units, Tuya uses kelvin
// Mired = 1.000.000/Kelvin

export class ColorTemperatureCharacteristic extends TuyaWebCharacteristic {
    public static Title = 'Characteristic.ColorTemperature'

    public static HomekitCharacteristic(accessory: BaseAccessory) {
      return accessory.platform.Characteristic.ColorTemperature;
    }

    private rangeMapper = MapRange.from(1000000 / 140, 1000000 / 500).to(10000, 1000)

    public static isSupportedByAccessory(accessory): boolean {
      return accessory.deviceConfig.data.color_temp !== undefined;
    }

    public getRemoteValue(callback: CharacteristicGetCallback): void {
      // Retrieve state from cache
      const cachedState = this.accessory.getCachedState(this.homekitCharacteristic);
      if (cachedState) {
        callback(null, cachedState);
      } else {
        // Retrieve device state from Tuya Web API
        this.accessory.platform.tuyaWebApi.getDeviceState<ColorTemperatureCharacteristicData>(this.accessory.deviceId).then((data) => {
          this.debug('[GET] %s', data?.color_temp);
          this.updateValue(data, callback);
        }).catch((error) => {
          this.error('[GET] %s', error.message);
          this.accessory.invalidateCache();
          callback(error);
        });
      }
    }

    public setRemoteValue(homekitValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
      if (typeof homekitValue !== 'number') {
        const errorMsg = `Received unexpected temperature value "${homekitValue}" of type ${typeof homekitValue}`;
        this.warn(errorMsg);
        callback(new Error(errorMsg));
        return;
      }

      // Set device state in Tuya Web API
      const value = Math.round(this.rangeMapper.map(1000000 / homekitValue));

      this.accessory.platform.tuyaWebApi.setDeviceState(this.accessory.deviceId, 'colorTemperatureSet', {value}).then(() => {
        this.debug('[SET] %s %s', homekitValue, value);
        this.accessory.setCachedState(this.homekitCharacteristic, homekitValue);
        callback();
      }).catch((error) => {
        this.error('[SET] %s', error.message);
        this.accessory.invalidateCache();
        callback(error);
      });
    }

    updateValue(data: DeviceWithColorTemperatureCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
      if (data?.color_temp !== undefined) {
        const homekitColorTemp = Math.round(this.rangeMapper.inverseMap(1000000 / data.color_temp));
        this.accessory.setCharacteristic(this.homekitCharacteristic, homekitColorTemp, !callback);
        callback && callback(null, homekitColorTemp);
      }
    }
}
