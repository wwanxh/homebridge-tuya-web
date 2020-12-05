import {TuyaDevice, TuyaDeviceState} from '../TuyaWebApi';
import {HomebridgeAccessory, TuyaWebPlatform} from '../platform';
import {Categories} from 'homebridge';
import {ActiveCharacteristicData} from './characteristics';
import {BaseAccessory} from './BaseAccessory';
import {CurrentTemperatureCharacteristic} from './characteristics/currentTemperature';
import {TargetHeatingCoolingStateCharacteristic} from './characteristics/targetHeatingCoolingState';
import {CurrentHeatingCoolingStateCharacteristic} from './characteristics/currentHeatingCoolingState';
import {TargetTemperatureCharacteristic} from './characteristics/targetTemperature';
import {TuyaDeviceDefaults} from '../config';

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
  }

  public get temperatureFactor(): number {
    if(this.deviceConfig.config?.temperature_factor) {
      return Number(this.deviceConfig.config.temperature_factor);
    }

    return 1;
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);
    if(config?.min_temper) {
      const minTemp = Number(config.min_temper);
      if(!minTemp) {
        errors.push('Wrong value configured for `min_temper`, should be a number');
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.min_temper = Math.round(minTemp * 2) / 2;
      }
    }

    if(config?.max_temper) {
      const maxTemp = Number(config.max_temper);
      if(!maxTemp) {
        errors.push('Wrong value configured for `max_temper`, should be a number');
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.max_temper = Math.round(maxTemp * 2) / 2;
      }
    }

    if(config?.temperature_factor) {
      const tempFactor = Number(config.temperature_factor);
      if(!tempFactor) {
        errors.push('Wrong value configured for `temperature_factor`, should be a number');
      } else {
        config.temperature_factor = tempFactor;
      }
    }

    if(errors.length) {
      //Return early to let users fix basic errors.
      return errors;
    }

    if(config?.min_temper && config?.max_temper && config.min_temper >= config.max_temper) {
      errors.push('The minimum temperature is larger then the maximum temperature');
    }
    return errors;
  }
}
