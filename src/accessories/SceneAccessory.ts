import {BaseAccessory} from './BaseAccessory';
import {TuyaDevice} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {MomentaryOnCharacteristic} from './characteristics/momentaryOn';

type SceneAccessoryConfig = TuyaDevice & {
  data: never
}

export class SceneAccessory extends BaseAccessory<SceneAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<SceneAccessoryConfig>,
    deviceConfig: SceneAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.SWITCH);

    new MomentaryOnCharacteristic(this as BaseAccessory);
  }
}
