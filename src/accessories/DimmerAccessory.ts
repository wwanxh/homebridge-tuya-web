import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {OnCharacteristic, OnCharacteristicData} from './characteristics';

type DimmerAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & OnCharacteristicData
}

export class DimmerAccessory extends BaseAccessory<DimmerAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<DimmerAccessoryConfig>,
    deviceConfig: DimmerAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.LIGHTBULB);

    new OnCharacteristic(this as BaseAccessory);
  }
}
