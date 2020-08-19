import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {OnCharacteristic, OnCharacteristicData} from './characteristics';

type SwitchAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & OnCharacteristicData
}

export class SwitchAccessory extends BaseAccessory<SwitchAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<SwitchAccessoryConfig>,
    deviceConfig: SwitchAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.SWITCH);

    new OnCharacteristic(this as BaseAccessory);
  }
}
