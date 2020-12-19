import { ClimateMode, ColorModes } from "../accessories/characteristics";
import { TuyaDeviceDefaults } from "../config";

export type DeviceState = Partial<{
  brightness: number | string;
  color: Partial<{ hue: string; saturation: string; brightness: string }>;
  color_mode: ColorModes;
  color_temp: number | string;
  current_temperature: number | string;
  max_temper: number | string;
  min_temper: number | string;
  mode: ClimateMode;
  online: boolean;
  speed: number | string;
  speed_level: number | string;
  state: boolean | "true" | "false";
  temperature: number | string;
}>;

export const TuyaDeviceTypes = [
  "climate",
  "dimmer",
  "fan",
  "light",
  "outlet",
  "scene",
  "switch",
] as const;
export type TuyaDeviceType = typeof TuyaDeviceTypes[number];

export const HomeAssistantDeviceTypes = [
  "climate",
  "dimmer",
  "fan",
  "light",
  "outlet",
  "scene",
  "switch",
] as const;
export type HomeAssistantDeviceType = typeof HomeAssistantDeviceTypes[number];

export type TuyaDevice = {
  data: DeviceState;
  name: string;
  id: string;
  dev_type: TuyaDeviceType;
  ha_type: HomeAssistantDeviceType;
  config?: Partial<TuyaDeviceDefaults> & { old_dev_type: TuyaDeviceType };
};

export type TuyaHeader = {
  code:
    | "FrequentlyInvoke"
    | "SUCCESS"
    | "TargetOffline"
    | "UnsupportedOperation"
    | string;
  payloadVersion: 1;
  msg?: string;
};

export type DiscoveryPayload = {
  payload: {
    devices: TuyaDevice[];
  };
  header: TuyaHeader;
};

export type DeviceQueryPayload = {
  payload: {
    data: DeviceState;
  };
  header: TuyaHeader;
};

export type TuyaApiMethod =
  | "turnOnOff"
  | "brightnessSet"
  | "windSpeedSet"
  | "colorSet"
  | "colorTemperatureSet"
  | "modeSet"
  | "temperatureSet";
export type TuyaApiPayload<
  Method extends TuyaApiMethod
> = Method extends "turnOnOff"
  ? { value: 0 | 1 }
  : Method extends "brightnessSet"
  ? { value: number }
  : Method extends "windSpeedSet"
  ? { value: number }
  : Method extends "colorSet"
  ? { color: { hue: number; saturation: number; brightness: number } }
  : Method extends "colorTemperatureSet"
  ? { value: number }
  : Method extends "modeSet"
  ? { value: ClimateMode }
  : Method extends "temperatureSet"
  ? { value: number }
  : never;
