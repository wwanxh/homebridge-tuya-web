import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {OnCharacteristic, OnCharacteristicData} from './characteristics';

type OutletAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & OnCharacteristicData
}

export class OutletAccessory extends BaseAccessory<OutletAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<OutletAccessoryConfig>,
    deviceConfig: OutletAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.OUTLET);

    new OnCharacteristic(this as BaseAccessory);
  }
}
