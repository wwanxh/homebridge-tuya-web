import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
  Units,
} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';
import {MapRange} from '../../helpers/MapRange';

export type RotationSpeedCharacteristicData = { speed_level: number, speed: string }
type DeviceWithRotationSpeedCharacteristic = TuyaDevice<TuyaDeviceState & RotationSpeedCharacteristicData>

export class RotationSpeedCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.RotationSpeed'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.RotationSpeed;
  }

  public range = MapRange.from(this.minStep, this.maxSpeedLevel * this.minStep).to( 1, this.maxSpeedLevel);

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      unit: Units.PERCENTAGE,
      format: Formats.INT,
      minValue: 0,
      maxValue: 100,
      minStep: this.minStep,
    });
  }

  public static isSupportedByAccessory(accessory): boolean {
    return accessory.deviceConfig.data.speed_level !== undefined &&
            accessory.deviceConfig.data.speed !== undefined;
  }

  public get maxSpeedLevel(): number {
    const data = this.accessory.deviceConfig.data as unknown as RotationSpeedCharacteristicData;
    return data.speed_level;
  }

  public get minStep(): number {
    return Math.floor(100 / this.maxSpeedLevel);
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory.getDeviceState<RotationSpeedCharacteristicData>().then((data) => {
      this.debug('[GET] %s', data?.speed);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));
  }

  public setRemoteValue(homekitValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
    // Set device state in Tuya Web API
    let value = this.range.map(Number(homekitValue));
    // Set value to 1 if value is too small
    value = value < 1 ? 1 : value;
    // Set value to minSpeedLevel if value is too large
    value = value > this.maxSpeedLevel ? this.maxSpeedLevel : value;

    this.accessory.setDeviceState('windSpeedSet', {value}, {speed: value}).then(() => {
      this.debug('[SET] %s %s', homekitValue, value);
      callback();
    }).catch(this.accessory.handleError('SET', callback));
  }

  updateValue(data: DeviceWithRotationSpeedCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    if (data?.speed !== undefined) {
      const speed = this.range.inverseMap(Number(data.speed));
      this.accessory.setCharacteristic(this.homekitCharacteristic, speed, !callback);
      callback && callback(null, speed);
    }
  }
}
