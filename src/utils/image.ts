import type { BasicFileInfo } from '../types/metadata';

export const calcMegapixels = (width: number, height: number): number => {
  if (!width || !height) return 0;
  return Number((width * height / 1_000_000).toFixed(2));
};

export const detectOrientation = (width: number, height: number): BasicFileInfo['orientation'] => {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
};

export const clampQuality = (quality: number): number => {
  if (Number.isNaN(quality)) return 0.92;
  return Math.min(1, Math.max(0.7, quality));
};
