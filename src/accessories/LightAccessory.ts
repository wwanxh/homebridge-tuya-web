import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {
  BrightnessCharacteristic,
  BrightnessCharacteristicData,
  ColorTemperatureCharacteristic,
  HueCharacteristic,
  OnCharacteristic,
  OnCharacteristicData,
  SaturationCharacteristic,
} from './characteristics';
import {ColorAccessory} from './ColorAccessory';

type LightAccessoryConfig = TuyaDevice<TuyaDeviceState & OnCharacteristicData & (BrightnessCharacteristicData)>

const COLOR_MODES = ['color', 'colour'] as const;
type ColorMode = typeof COLOR_MODES[number];

export class LightAccessory extends ColorAccessory<LightAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<LightAccessoryConfig>,
    deviceConfig: LightAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.LIGHTBULB);

    new OnCharacteristic(this as ColorAccessory);
    new BrightnessCharacteristic(this as ColorAccessory);
    new ColorTemperatureCharacteristic(this as ColorAccessory);
    new HueCharacteristic(this as ColorAccessory);
    new SaturationCharacteristic(this as ColorAccessory);

  }
}
