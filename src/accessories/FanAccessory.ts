import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {ActiveCharacteristic, OnCharacteristicData, RotationSpeedCharacteristic} from './characteristics';

type FanAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & OnCharacteristicData
}

export class FanAccessory extends BaseAccessory<FanAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<FanAccessoryConfig>,
    deviceConfig: FanAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.FAN);

    new ActiveCharacteristic(this as BaseAccessory);
    new RotationSpeedCharacteristic(this as BaseAccessory);
  }
}
