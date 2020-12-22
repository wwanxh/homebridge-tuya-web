import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";

export class CurrentPositionCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentPosition";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentPosition;
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

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    this.debug(`Updating value`, data);
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
