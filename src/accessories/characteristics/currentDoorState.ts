import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";

export class CurrentDoorStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentDoorState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentDoorState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public get CurrentDoorState() {
    return this.accessory.platform.Characteristic.CurrentDoorState;
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
        1: this.CurrentDoorState.OPEN,
        2: this.CurrentDoorState.STOPPED,
        3: this.CurrentDoorState.CLOSED,
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
          ? this.CurrentDoorState.OPEN
          : this.CurrentDoorState.CLOSED;
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback
      );
      callback && callback(null, stateValue);
    } else {
      this.error(`Unexpected state value provided: ${data?.state}`);
    }
  }
}
