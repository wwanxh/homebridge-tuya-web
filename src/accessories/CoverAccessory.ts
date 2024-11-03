import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  CurrentPositionCharacteristic,
  GeneralCharacteristic,
  PositionStateCharacteristic,
  TargetPositionCharacteristic,
} from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import { TuyaDevice } from "../api/response";
import { HoldPositionCharacteristic } from "./characteristics/holdPosition";

export class CoverAccessory extends BaseAccessory {
    public target = 0;
    public position = 0;
    public motor = 2;

  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Categories.WINDOW_COVERING,
    );
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentPositionCharacteristic,
      HoldPositionCharacteristic,
      PositionStateCharacteristic,
      TargetPositionCharacteristic,
    ];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentPositionCharacteristic,
      PositionStateCharacteristic,
      TargetPositionCharacteristic,
    ];
  }

  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    // Get supported characteristics from configuration
    if (Array.isArray(this.deviceConfig.config?.cover_characteristics)) {
      const supportedCharacteristics: GeneralCharacteristic[] = [];
      const configuredCharacteristics =
        this.deviceConfig.config?.cover_characteristics ?? [];
      if (configuredCharacteristics.includes("Stop")) {
        supportedCharacteristics.push(HoldPositionCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }
}
