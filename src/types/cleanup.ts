export interface ManualMask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AntiSearchParams {
  level: number;
  crop: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  rotation: number;
  noiseSeed: number;
  noiseAmplitude: number;
  brightnessShift: number;
  contrastShift: number;
  warpStrength: number;
  hueShift: number;
  saturationShift: number;
}

export type PrivacyLevel = 'low' | 'medium' | 'high';

export interface CleanupPreviewDimensions {
  width: number;
  height: number;
}

export type JpegQualitySetting = 'low' | 'medium' | 'original';
