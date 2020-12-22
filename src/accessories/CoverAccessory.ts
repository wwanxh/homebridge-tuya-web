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

export class CoverAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory,
    deviceConfig: TuyaDevice
  ) {
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Categories.WINDOW_COVERING
    );
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentPositionCharacteristic,
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
}
