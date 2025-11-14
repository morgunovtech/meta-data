export interface ManualMaskRegion {
  id: string;
  x: number; // relative 0..1
  y: number; // relative 0..1
  width: number; // relative 0..1
  height: number; // relative 0..1
}

export interface CleanupOptions {
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  jpegQuality: number;
  renameFile: boolean;
  renameToken: string | null;
  antiSearchEnabled: boolean;
  antiSearchStrength: number; // 0-3
  antiSearchSeed: number;
  manualMasks: ManualMaskRegion[];
  reduceColors: boolean;
  addWatermark: boolean;
}

export type CleanupPresetKey = 'basic' | 'strong' | 'custom';
