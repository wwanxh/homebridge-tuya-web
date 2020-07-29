import {TuyaDevice, TuyaDeviceState} from '../../TuyaWebApi';
import {CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue} from 'homebridge';
import {TuyaWebCharacteristic} from './base';
import {BaseAccessory} from '../BaseAccessory';

export type ActiveCharacteristicData = { state: boolean | 'true' | 'false' }
type DeviceWithActiveCharacteristic = TuyaDevice<TuyaDeviceState & ActiveCharacteristicData>

export class ActiveCharacteristic extends TuyaWebCharacteristic {
    public static Title = 'Characteristic.Active'

    public static HomekitCharacteristic(accessory: BaseAccessory) {
      return accessory.platform.Characteristic.Active;
    }

    public static isSupportedByAccessory(accessory): boolean {
      return accessory.deviceConfig.data.state !== undefined;
    }

    public getRemoteValue(callback: CharacteristicGetCallback): void {
      // Retrieve state from cache
      const cachedState = this.accessory.getCachedState(this.homekitCharacteristic);
      if (cachedState) {
        callback(null, cachedState);
      } else {
        // Retrieve device state from Tuya Web API
        this.accessory.platform.tuyaWebApi.getDeviceState<ActiveCharacteristicData>(this.accessory.deviceId).then((data) => {
          this.debug('[GET] %s', data?.state);
          this.updateValue(data, callback);
        }).catch((error) => {
          this.error('[GET] %s', error.message);
          this.accessory.invalidateCache();
          callback(error);
        });
      }
    }

    public setRemoteValue(homekitValue: CharacteristicValue, callback: CharacteristicSetCallback): void {
      // Set device state in Tuya Web API
      const value = homekitValue ? 1 : 0;

      this.accessory.platform.tuyaWebApi.setDeviceState(this.accessory.deviceId, 'turnOnOff', {value}).then(() => {
        this.debug('[SET] %s %s', homekitValue, value);
        this.accessory.setCachedState(this.homekitCharacteristic, homekitValue);
        callback();
      }).catch((error) => {
        this.error('[SET] %s', error.message);
        this.accessory.invalidateCache();
        callback(error);
      });
    }

    updateValue(data: DeviceWithActiveCharacteristic['data'] | undefined, callback?: CharacteristicGetCallback): void {
      if (data?.state !== undefined) {
        const stateValue = (String(data.state).toLowerCase() === 'true');
        this.accessory.setCharacteristic(this.homekitCharacteristic, stateValue, !callback);
        callback && callback(null, stateValue);
      }
    }
}
