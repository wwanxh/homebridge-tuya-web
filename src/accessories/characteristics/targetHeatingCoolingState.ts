import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';
import {ClimateMode} from '../ClimateAccessory';
import {ActiveCharacteristicData} from './active';

export type TargetHeaterCoolerStateCharacteristicData = { mode?: ClimateMode } & ActiveCharacteristicData
type DeviceWithTargetHeaterCoolerStateCharacteristic = TuyaDevice<TuyaDeviceState & TargetHeaterCoolerStateCharacteristicData>

export class TargetHeatingCoolingStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.TargetHeatingCoolingState'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetHeatingCoolingState;
  }

  public static isSupportedByAccessory(accessory): boolean {
    return accessory.deviceConfig.data.mode !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory.getDeviceState<TargetHeaterCoolerStateCharacteristicData>().then((data) => {
      this.debug('[GET] mode: %s', data);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));
  }

  private get TargetHeatingCoolingState() {
    return this.accessory.platform.Characteristic.TargetHeatingCoolingState;
  }

  public setRemoteValue(homekitValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (homekitValue === this.TargetHeatingCoolingState.OFF) {
      this.accessory.setDeviceState('turnOnOff', {value: 0}, {state: false}).then(() => {
        this.debug('[SET] %s', homekitValue);
        callback();
      }).catch(this.accessory.handleError('SET', callback));
      return;
    }
    const map: { [key: number]: ClimateMode } = {
      [this.TargetHeatingCoolingState.AUTO]: 'auto',
      [this.TargetHeatingCoolingState.HEAT]: 'hot',
      [this.TargetHeatingCoolingState.COOL]: 'cold',
    };

    const value = map[homekitValue as string];
    this.accessory.setDeviceState('turnOnOff', {value: 1}, {mode: value}).then(() => {
      this.accessory.setDeviceState('modeSet', {value}, {mode: value}).then(() => {
        this.debug('[SET] %s %s', homekitValue, value);
        callback();
      }).catch(this.accessory.handleError('SET', callback));
    }).catch(this.accessory.handleError('SET', callback));
  }

  updateValue(data: DeviceWithTargetHeaterCoolerStateCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    if (String(data?.state).toLowerCase() === 'false') {
      this.accessory.setCharacteristic(this.homekitCharacteristic, this.TargetHeatingCoolingState.OFF, !callback);
      callback && callback(null, this.TargetHeatingCoolingState.OFF);
      return;
    }

    const mode = {
      'auto': this.TargetHeatingCoolingState.AUTO,
      'wind': this.TargetHeatingCoolingState.AUTO,
      'hot': this.TargetHeatingCoolingState.HEAT,
      'cold': this.TargetHeatingCoolingState.COOL,
    }[data?.mode || 'auto'];
    if (mode) {
      this.accessory.setCharacteristic(this.homekitCharacteristic, mode, !callback);
      callback && callback(null, mode);
    }
  }
}
