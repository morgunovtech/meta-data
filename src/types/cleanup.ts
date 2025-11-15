export interface ManualMaskRegion {
  id: string;
  /** Normalized X coordinate (0..1) */
  x: number;
  /** Normalized Y coordinate (0..1) */
  y: number;
  /** Normalized width (0..1) */
  width: number;
  /** Normalized height (0..1) */
  height: number;
}

export interface AntiSearchParams {
  crop: number;
  rotationDeg: number;
  noiseAmplitude: number;
  brightnessDelta: number;
  seed: number;
}
