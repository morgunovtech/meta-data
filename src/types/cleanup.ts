export interface ManualMaskRegion {
  id: string;
  /** Normalised x position (0-1) */
  x: number;
  /** Normalised y position (0-1) */
  y: number;
  /** Normalised width (0-1) */
  width: number;
  /** Normalised height (0-1) */
  height: number;
}

export interface AntiSearchOptions {
  enabled: boolean;
  intensity: number;
  seed: number;
}

export interface CleanupOptions {
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  manualMaskEnabled: boolean;
  manualMasks: ManualMaskRegion[];
  antiSearch: AntiSearchOptions;
  reduceColor: boolean;
  watermark: boolean;
  renameFile: boolean;
}

export interface CleanupPresetConfig {
  id: string;
  labelKey: string;
  descriptionKey: string;
  options: Partial<CleanupOptions> & {
    blurStrength?: number;
    antiSearch?: Partial<AntiSearchOptions>;
  };
}
