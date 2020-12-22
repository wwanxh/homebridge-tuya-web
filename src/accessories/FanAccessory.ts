import { BaseAccessory } from "./BaseAccessory";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  ActiveCharacteristic,
  GeneralCharacteristic,
  RotationSpeedCharacteristic,
} from "./characteristics";
import { TuyaDevice } from "../api/response";

export class FanAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory,
    deviceConfig: TuyaDevice
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.FAN);
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [ActiveCharacteristic, RotationSpeedCharacteristic];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [ActiveCharacteristic];
  }

  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    // Get supported characteristics from configuration
    if (this.deviceConfig.config) {
      const supportedCharacteristics: GeneralCharacteristic[] = [];
      if (
        (this.deviceConfig.config?.fan_characteristics || []).includes("Speed")
      ) {
        supportedCharacteristics.push(RotationSpeedCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }
}
