export * from './active';
export * from './brightness';
export * from './colorTemperature';
export * from './hue';
export * from './on';
export * from './rotationSpeed';
export * from './saturation';

export const COLOR_MODES = ['color', 'colour'] as const;
export type ColorModes = typeof COLOR_MODES[number] | 'white';

