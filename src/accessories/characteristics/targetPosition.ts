import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
  Units,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";
import delay from "../../helpers/delay";

export class TargetPositionCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetPosition";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetPosition;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      unit: Units.PERCENTAGE,
      format: Formats.INT,
      minValue: 0,
      maxValue: 100,
      minStep: 100,
    });
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.state);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback
  ): void {
    const value = (homekitValue as number) === 0 ? 0 : 1;

    const data = { state: value === 0 ? 3 : 1 };

    this.accessory
      .setDeviceState("turnOnOff", { value }, data)
      .then(async () => {
        this.debug("[SET] %s", value);
        callback();

        await delay(1000);
        this.accessory.setTuyaCharacteristic(
          this.accessory.platform.Characteristic.CurrentPosition,
          data
        );
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (!isNaN(Number(String(data?.state)))) {
      //State is a number and probably 1, 2 or 3
      const state = Number(data.state);
      const stateValue = {
        1: 100,
        2: 50,
        3: 0,
      }[state];

      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback
      );
      callback && callback(null, stateValue);
    } else if (["true", "false"].includes(String(data?.state).toLowerCase())) {
      const stateValue = String(data.state).toLowerCase() === "true" ? 100 : 0;
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback
      );
      callback && callback(null, stateValue);
    } else {
      callback &&
        callback(new Error(`Unexpected state value provided: ${data?.state}`));
    }
  }
}
