import { BaseAccessory, CharacteristicConstructor } from "../BaseAccessory";
import { LogLevel } from "homebridge";
import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";

export abstract class TuyaWebCharacteristic<
  Accessory extends BaseAccessory = BaseAccessory
> {
  public static Title: string;
  public static HomekitCharacteristic: (
    accessory: BaseAccessory
  ) => CharacteristicConstructor;

  public setProps(characteristic?: Characteristic): Characteristic | undefined {
    return characteristic;
  }

  constructor(protected accessory: Accessory) {
    this.enable();
  }

  private get staticInstance(): typeof TuyaWebCharacteristic {
    return <typeof TuyaWebCharacteristic>this.constructor;
  }

  public get title(): string {
    return this.staticInstance.Title;
  }

  public get homekitCharacteristic(): CharacteristicConstructor {
    return this.staticInstance.HomekitCharacteristic(this.accessory);
  }

  private log(logLevel: LogLevel, message: string, ...args: unknown[]): void {
    this.accessory.log.log(
      logLevel,
      `[%s] %s - ${message}`,
      this.accessory.name,
      this.title,
      ...args
    );
  }

  protected debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  protected info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  protected error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  public abstract getRemoteValue(callback: CharacteristicGetCallback): void;

  public setRemoteValue?(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback
  ): void;

  public abstract updateValue(
    data?: Accessory["deviceConfig"]["data"],
    callback?: CharacteristicGetCallback
  ): void;

  private enable(): void {
    const char = this.setProps(
      this.accessory.service?.getCharacteristic(this.homekitCharacteristic)
    );

    if (char) {
      this.debug(JSON.stringify(char.props));
      char.on("get", this.getRemoteValue.bind(this));
      if (this.setRemoteValue) {
        char.on("set", this.setRemoteValue.bind(this));
      }
    }

    this.accessory.addUpdateCallback(
      this.homekitCharacteristic,
      this.updateValue.bind(this)
    );
  }
}
