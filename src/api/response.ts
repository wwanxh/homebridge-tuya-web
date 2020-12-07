import { ClimateMode, ColorModes } from "../accessories/characteristics";

export type State = Partial<{
  online: boolean;
  state: boolean | "true" | "false";
  mode: ClimateMode;
  current_temperature: number | string;
  temperature: number | string;
  color: Partial<{ hue: string; saturation: string }>;
  color_mode: ColorModes;
  speed_level: number | string;
  speed: number | string;
  min_temper: number | string;
  max_temper: number | string;
}>;
