import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {CharacteristicGetCallback} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';
import {ClimateMode} from '../ClimateAccessory';
import {ActiveCharacteristicData} from './active';

export type CurrentHeaterCoolerStateCharacteristicData = { mode?: ClimateMode } & ActiveCharacteristicData
type DeviceWithCurrentHeaterCoolerStateCharacteristic = TuyaDevice<TuyaDeviceState & CurrentHeaterCoolerStateCharacteristicData>

export class CurrentHeatingCoolingStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.CurrentHeatingCoolingState'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentHeatingCoolingState;
  }

  public static isSupportedByAccessory(accessory): boolean {
    return accessory.deviceConfig.data.mode !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory.getDeviceState<CurrentHeaterCoolerStateCharacteristicData>().then((data) => {
      this.debug('[GET] mode: %s', data);
      this.updateValue(data, callback);
    }).catch(this.accessory.handleError('GET', callback));
  }

  private get CurrentHeatingCoolingState () {
    return this.accessory.platform.Characteristic.CurrentHeatingCoolingState;
  }

  updateValue(data: DeviceWithCurrentHeaterCoolerStateCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
    if (String(data?.state).toLowerCase() === 'false') {
      this.accessory.setCharacteristic(this.homekitCharacteristic, this.CurrentHeatingCoolingState.OFF, !callback);
      callback && callback(null, this.CurrentHeatingCoolingState.OFF);
      return;
    }

    const mode = {
      'auto': this.CurrentHeatingCoolingState.COOL,
      'wind': this.CurrentHeatingCoolingState.COOL,
      'hot': this.CurrentHeatingCoolingState.HEAT,
      'cold': this.CurrentHeatingCoolingState.COOL,
    }[data?.mode || 'auto'];
    if (mode) {
      this.accessory.setCharacteristic(this.homekitCharacteristic, mode, !callback);
      callback && callback(null, mode);
    }
  }
}
