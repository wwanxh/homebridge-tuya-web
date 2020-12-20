import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import { GeneralCharacteristic } from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import { TuyaDevice } from "../api/response";
import { CurrentPositionCharacteristic } from "./characteristics/currentPosition";
import { PositionStateCharacteristic } from "./characteristics/positionState";
import { TargetPositionCharacteristic } from "./characteristics/targetPosition";

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
