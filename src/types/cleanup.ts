export interface ManualMaskPoint {
  x: number;
  y: number;
}

export interface ManualMask {
  id: string;
  points: ManualMaskPoint[];
  radius: number;
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

export type QualityMode = 'low' | 'medium' | 'original';

export interface CleanupPreviewDimensions {
  width: number;
  height: number;
}

export type PresetKey = 'none' | 'social' | 'work' | 'proof' | 'personal';
