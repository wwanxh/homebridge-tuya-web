import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";
import delay from "../../helpers/delay";

export class TargetDoorStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetDoorState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetDoorState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public get TargetDoorState() {
    return this.accessory.platform.Characteristic.TargetDoorState;
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
    const value =
      (homekitValue as number) === this.TargetDoorState.CLOSED ? 0 : 1;

    const data = { state: value === 0 ? 3 : 1 };

    this.accessory
      .setDeviceState("turnOnOff", { value }, data)
      .then(async () => {
        this.debug("[SET] %s", value);
        callback();

        await delay(1000);
        this.accessory.setTuyaCharacteristic(
          this.accessory.platform.Characteristic.CurrentDoorState,
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
        1: this.TargetDoorState.OPEN,
        2: this.TargetDoorState.OPEN,
        3: this.TargetDoorState.CLOSED,
      }[state];

      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback
      );
      callback && callback(null, stateValue);
    } else if (["true", "false"].includes(String(data?.state).toLowerCase())) {
      const stateValue =
        String(data.state).toLowerCase() === "true"
          ? this.TargetDoorState.OPEN
          : this.TargetDoorState.CLOSED;
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
