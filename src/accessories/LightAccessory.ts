import { TuyaDevice, TuyaDeviceState } from "../TuyaWebApi";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  BrightnessCharacteristic,
  BrightnessCharacteristicData,
  Characteristic,
  ColorTemperatureCharacteristic,
  HueCharacteristic,
  OnCharacteristic,
  OnCharacteristicData,
  SaturationCharacteristic,
} from "./characteristics";
import { ColorAccessory } from "./ColorAccessory";
import { TuyaDeviceDefaults } from "../config";

type LightAccessoryConfig = TuyaDevice<
  TuyaDeviceState & OnCharacteristicData & BrightnessCharacteristicData
>;

export class LightAccessory extends ColorAccessory<LightAccessoryConfig> {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory<LightAccessoryConfig>,
    deviceConfig: LightAccessoryConfig
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.LIGHTBULB);
  }

  public supportedCharacteristics(): Characteristic[] {
    return [
      OnCharacteristic,
      BrightnessCharacteristic,
      ColorTemperatureCharacteristic,
      HueCharacteristic,
      SaturationCharacteristic,
    ];
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);
    if (config?.min_temper) {
      const minTemp = Number(config.min_temper);
      if (!minTemp) {
        errors.push(
          "Wrong value configured for `min_temper`, should be a number"
        );
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.min_temper = Math.round(minTemp * 2) / 2;
      }
    }

    if (config?.max_temper) {
      const maxTemp = Number(config.max_temper);
      if (!maxTemp) {
        errors.push(
          "Wrong value configured for `max_temper`, should be a number"
        );
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.max_temper = Math.round(maxTemp * 2) / 2;
      }
    }

    if (config?.temperature_factor) {
      const tempFactor = Number(config.temperature_factor);
      if (!tempFactor) {
        errors.push(
          "Wrong value configured for `temperature_factor`, should be a number"
        );
      } else {
        config.temperature_factor = tempFactor;
      }
    }

    if (errors.length) {
      //Return early to let users fix basic errors.
      return errors;
    }

    if (
      config?.min_temper &&
      config?.max_temper &&
      config.min_temper >= config.max_temper
    ) {
      errors.push(
        "The minimum temperature is larger then the maximum temperature"
      );
    }
    return errors;
  }
}
