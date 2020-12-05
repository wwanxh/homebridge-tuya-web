import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';
import {ClimateAccessory} from '../ClimateAccessory';

export type TargetTemperatureCharacteristicData = {
  temperature: number,
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
    if(this.accessory.deviceConfig.config?.min_temper) {
      return Number(this.accessory.deviceConfig.config.min_temper);
    }

    const data = this.accessory.deviceConfig.data as unknown as TargetTemperatureCharacteristicData;
    if(data.min_temper) {
      return data.min_temper * (this.accessory as ClimateAccessory).temperatureFactor;
    }

    return 0;
  }

  public get maxTemp(): number {
    if(this.accessory.deviceConfig.config?.max_temper) {
      return Number(this.accessory.deviceConfig.config.max_temper);
    }

    const data = this.accessory.deviceConfig.data as unknown as TargetTemperatureCharacteristicData;
    if(data.max_temper) {
      return data.max_temper * (this.accessory as ClimateAccessory).temperatureFactor;
    }

    return 100;
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
      this.debug('[GET] temperature: %s', data?.temperature);
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
    const temperature = data?.temperature ? data?.temperature * (this.accessory as ClimateAccessory).temperatureFactor : undefined;
    if (temperature) {
      this.accessory.setCharacteristic(this.homekitCharacteristic, temperature, !callback);
      callback && callback(null, temperature);
    } else {
      callback && callback(new Error('Could not get temperature from data'));
    }
  }
}
