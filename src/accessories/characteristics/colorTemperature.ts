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
    this.accessory.getDeviceState<ColorTemperatureCharacteristicData>().then((data) => {
      this.debug('[GET] %s', data?.color_temp);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));

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

    this.accessory.setDeviceState('colorTemperatureSet', {value}, {color_temp: homekitValue}).then(() => {
      this.debug('[SET] %s %s', homekitValue, value);
      callback();
    }).catch(this.accessory.handleError('SET', callback));
  }

  updateValue(data: DeviceWithColorTemperatureCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    if (data?.color_temp !== undefined) {
      const homekitColorTemp = Math.round(this.rangeMapper.inverseMap(1000000 / data.color_temp));
      this.accessory.setCharacteristic(this.homekitCharacteristic, homekitColorTemp, !callback);
      callback && callback(null, homekitColorTemp);
    }
  }
}
