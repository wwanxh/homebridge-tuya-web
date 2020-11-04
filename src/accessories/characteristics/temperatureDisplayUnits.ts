import {TuyaDevice} from '../../TuyaWebApi';
import {CharacteristicGetCallback} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';


export class TemperatureDisplayUnitsCharacteristic extends TuyaWebCharacteristic {
  public static Title = 'Characteristic.TemperatureDisplayUnits'

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TemperatureDisplayUnits;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.updateValue(undefined, callback);
  }

  private get TemperatureDisplayUnits () {
    return this.accessory.platform.Characteristic.TemperatureDisplayUnits;
  }

  updateValue(data: TuyaDevice['data'] | undefined, callback?: CharacteristicGetCallback): void {
    callback && callback(null, this.TemperatureDisplayUnits.CELSIUS);
  }
}
