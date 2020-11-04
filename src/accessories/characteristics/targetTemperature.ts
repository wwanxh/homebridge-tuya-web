import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';

export type TargetTemperatureCharacteristicData = {
  current_temperature?: number,
  temperature: string,
  min_temper?: number,
  max_temper?: number
}
type DeviceWithCurrentTemperatureCharacteristic = TuyaDevice<TuyaDeviceState & TargetTemperatureCharacteristicData>

export class TargetTemperatureCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.TargetTemperature'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetTemperature;
  }

  public get minTemp(): number {
    const data = this.accessory.deviceConfig.data as unknown as TargetTemperatureCharacteristicData;
    return data.min_temper || 0;
  }

  public get maxTemp(): number {
    const data = this.accessory.deviceConfig.data as unknown as TargetTemperatureCharacteristicData;
    return data.max_temper || 100;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      minValue: this.minTemp,
      maxValue: this.maxTemp,
    });
  }

  public static isSupportedByAccessory(accessory): boolean {
    return accessory.deviceConfig.data.temperature !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory.getDeviceState<TargetTemperatureCharacteristicData>().then((data) => {
      this.debug('[GET] current_temp: %s - temp: %s', data?.current_temperature, data?.temperature);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));
  }

  public setRemoteValue(homekitValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const temperature = Number(homekitValue);

    this.accessory.setDeviceState('temperatureSet', {value: temperature}, {temperature}).then(() => {
      this.debug('[SET] %s %s', homekitValue, temperature);
      callback();
    }).catch(this.accessory.handleError('SET', callback));
  }

  updateValue(data: DeviceWithCurrentTemperatureCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    const currentTemperature = data?.current_temperature || data?.temperature;
    if (currentTemperature) {
      this.accessory.setCharacteristic(this.homekitCharacteristic, currentTemperature, !callback);
      callback && callback(null, currentTemperature);
    } else {
      callback && callback(new Error('Could not get temperature from data'));
    }
  }
}
