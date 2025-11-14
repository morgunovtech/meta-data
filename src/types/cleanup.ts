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
}

export type PrivacyLevel = 'low' | 'medium' | 'high';

export type PrivacyPresetId = 'minimal' | 'balanced' | 'maximal';

export interface CleanupPreviewDimensions {
  width: number;
  height: number;
}
