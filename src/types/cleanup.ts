export interface ManualMask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AntiSearchParams {
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
  saturationShift: number;
  hueShift: number;
  warpStrength: number;
}

export type PrivacyLevel = 'low' | 'medium' | 'high';

export type QualityMode = 'low' | 'medium' | 'original';

export interface CleanupPreviewDimensions {
  width: number;
  height: number;
}
