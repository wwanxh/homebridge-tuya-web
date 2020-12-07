import { ActiveCharacteristic } from "./active";
import { BrightnessCharacteristic } from "./brightness";
import { ColorTemperatureCharacteristic } from "./colorTemperature";
import { CurrentHeatingCoolingStateCharacteristic } from "./currentHeatingCoolingState";
import { CurrentTemperatureCharacteristic } from "./currentTemperature";
import { HueCharacteristic } from "./hue";
import { MomentaryOnCharacteristic } from "./momentaryOn";
import { OnCharacteristic } from "./on";
import { RotationSpeedCharacteristic } from "./rotationSpeed";
import { SaturationCharacteristic } from "./saturation";
import { TargetHeatingCoolingStateCharacteristic } from "./targetHeatingCoolingState";
import { TargetTemperatureCharacteristic } from "./targetTemperature";

export * from "./active";
export * from "./brightness";
export * from "./colorTemperature";
export * from "./currentHeatingCoolingState";
export * from "./currentTemperature";
export * from "./hue";
export * from "./momentaryOn";
export * from "./on";
export * from "./rotationSpeed";
export * from "./saturation";
export * from "./targetHeatingCoolingState";
export * from "./targetTemperature";

export const COLOR_MODES = ["color", "colour"] as const;
export type ColorModes = typeof COLOR_MODES[number] | "white";

export const CLIMATE_MODES = ["cold", "hot", "wind", "auto"] as const;
export type ClimateMode = typeof CLIMATE_MODES[number];

export type Characteristic =
  | typeof ActiveCharacteristic
  | typeof BrightnessCharacteristic
  | typeof ColorTemperatureCharacteristic
  | typeof CurrentHeatingCoolingStateCharacteristic
  | typeof CurrentTemperatureCharacteristic
  | typeof HueCharacteristic
  | typeof MomentaryOnCharacteristic
  | typeof OnCharacteristic
  | typeof RotationSpeedCharacteristic
  | typeof SaturationCharacteristic
  | typeof TargetHeatingCoolingStateCharacteristic
  | typeof TargetTemperatureCharacteristic;
