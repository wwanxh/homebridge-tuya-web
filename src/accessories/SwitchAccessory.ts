import { BaseAccessory } from "./BaseAccessory";
import { TuyaDevice, TuyaDeviceState } from "../TuyaWebApi";
import {
  Characteristic,
  OnCharacteristic,
  OnCharacteristicData,
} from "./characteristics";

type SwitchAccessoryConfig = TuyaDevice & {
  data: TuyaDeviceState & OnCharacteristicData;
};

export class SwitchAccessory extends BaseAccessory<SwitchAccessoryConfig> {
  supportedCharacteristics(): Characteristic[] {
    return [OnCharacteristic];
  }
}
