import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {CharacteristicGetCallback} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';

export type CurrentTemperatureCharacteristicData = { current_temperature?: number, temperature: string }
type DeviceWithCurrentTemperatureCharacteristic = TuyaDevice<TuyaDeviceState & CurrentTemperatureCharacteristicData>

export class CurrentTemperatureCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.CurrentTemperature'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentTemperature;
  }

  public static isSupportedByAccessory(accessory): boolean {
    return accessory.deviceConfig.data.current_temperature;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory.getDeviceState<CurrentTemperatureCharacteristicData>().then((data) => {
      this.debug('[GET] current_temp: %s', data?.current_temperature);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));
  }

  updateValue(data: DeviceWithCurrentTemperatureCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    const currentTemperature = data?.current_temperature ? data?.current_temperature / 10 : undefined;
    if (currentTemperature) {
      this.accessory.setCharacteristic(this.homekitCharacteristic, currentTemperature, !callback);
      callback && callback(null, currentTemperature);
    } else {
      callback && callback(new Error('Could not get temperature from data'));
    }
  }
}
