export interface ResolutionSettings {
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio: boolean;
  scalingAlgorithm: 'bilinear' | 'bicubic' | 'lanczos' | 'nearest';
  sharpening: {
    enabled: boolean;
    strength: number; // 0-1
    radius: number; // 0.5-5.0
  };
  noiseReduction: {
    enabled: boolean;
    strength: number; // 0-1
  };
}

export interface SharpeningSettings {
  enabled: boolean;
  strength: number; // 0-1
  radius: number; // 0.5-5.0
}

export interface NoiseReductionSettings {
  enabled: boolean;
  strength: number; // 0-1
}

export interface HighlightSettings {
  adjustment: number; // -100 to 100
  threshold: number; // 0.5 to 1.0
}

export interface ShadowSettings {
  adjustment: number; // -100 to 100
  threshold: number; // 0.0 to 0.5
}

export interface GammaSettings {
  red: number; // 0.1 to 3.0
  green: number; // 0.1 to 3.0
  blue: number; // 0.1 to 3.0
}

export interface HdrToSdrSettings {
  enabled: boolean;
  nits: number; // 100 to 10000
  method: 'reinhard' | 'aces' | 'hable';
}

export interface AutoAdjustmentSettings {
  enabled: boolean;
  targetLuminance: number; // 0.0 to 1.0
  adaptationSpeed: number; // 0.1 to 1.0
}

export interface AdvancedBrightnessSettings {
  globalBrightness: number; // -100 to 100
  highlights: HighlightSettings;
  shadows: ShadowSettings;
  gamma: GammaSettings;
  hdrToSdr: HdrToSdrSettings;
  autoAdjustment: AutoAdjustmentSettings;
}

export interface ColorTemperatureSettings {
  kelvin: number; // 2000 to 10000
  tint: number; // -100 to 100
}

export interface HsvSettings {
  hue: number; // -180 to 180
  saturation: number; // -100 to 100
  value: number; // -100 to 100
}

export interface ColorProfileSettings {
  input: 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec2020';
  output: 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec2020';
  renderingIntent: 'perceptual' | 'relative' | 'saturation' | 'absolute';
}

export interface ColorCorrectionPoint {
  x: number;
  y: number;
  targetR: number;
  targetG: number;
  targetB: number;
}

export interface ColorCorrectionSettings {
  enabled: boolean;
  referencePoints: ColorCorrectionPoint[];
}

export type ColorBlindnessMode = 'none' | 'simulate' | 'compensate';
export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface ColorBlindnessSettings {
  simulation: ColorBlindnessType;
  compensation: boolean;
}

export interface AdvancedColorSettings {
  colorTemperature: ColorTemperatureSettings;
  hsv: HsvSettings;
  colorProfile: ColorProfileSettings;
  colorCorrection: ColorCorrectionSettings;
  colorBlindness: ColorBlindnessSettings;
}

export interface EnvironmentSettings {
  ambientLight: number; // 0.0 to 1.0
  screenGain: number; // 0.8 to 2.5
  throwDistance: number; // メートル単位
  screenType: 'matte' | 'glass_beaded' | 'high_gain';
}

export interface ProjectorPreviewSettings {
  resolution: ResolutionSettings;
  brightness: AdvancedBrightnessSettings;
  color: AdvancedColorSettings;
  environment: EnvironmentSettings;
}

export interface LuminanceAnalysis {
  average: number;
  histogram: number[];
  dynamicRange: number;
}

export interface ColorDistribution {
  dominantColors: Array<{ rgb: [number, number, number]; percentage: number }>;
  gamut: string;
  whiteBalance: { temperature: number; tint: number };
}

export interface ColorGamut {
  primaries: {
    red: { x: number; y: number };
    green: { x: number; y: number };
    blue: { x: number; y: number };
    white: { x: number; y: number };
  };
  gamma: number;
}

// Rectangle型はtextModel.tsに統合されました