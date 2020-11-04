import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {ActiveCharacteristicData} from './characteristics';
import {BaseAccessory} from './BaseAccessory';
import {CurrentTemperatureCharacteristic} from './characteristics/currentTemperature';
import {TargetHeatingCoolingStateCharacteristic} from './characteristics/targetHeatingCoolingState';
import {CurrentHeatingCoolingStateCharacteristic} from './characteristics/currentHeatingCoolingState';
import Base = Mocha.reporters.Base;
import {TargetTemperatureCharacteristic} from './characteristics/targetTemperature';
import {TemperatureDisplayUnitsCharacteristic} from './characteristics/temperatureDisplayUnits';

export type ClimateMode = 'cold' | 'hot' | 'wind' | 'auto';
type ClimateAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & ActiveCharacteristicData & {
    max_temper: number,
    min_temper: number,
    temperature: number,
    mode?: ClimateMode,
    support_mode?: ClimateMode[]
    temp_unit?: 'CELSIUS',
    current_temperature?: number,
  }
}

export class ClimateAccessory extends BaseAccessory<ClimateAccessoryConfig> {

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<ClimateAccessoryConfig>,
    deviceConfig: ClimateAccessoryConfig) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.THERMOSTAT);

    new CurrentTemperatureCharacteristic(this as BaseAccessory);
    new TargetTemperatureCharacteristic(this as BaseAccessory);
    new CurrentHeatingCoolingStateCharacteristic(this as BaseAccessory);
    new TargetHeatingCoolingStateCharacteristic(this as BaseAccessory);
    new TemperatureDisplayUnitsCharacteristic(this as BaseAccessory);
  }
}
