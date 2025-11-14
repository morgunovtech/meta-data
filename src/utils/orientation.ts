export type Orientation = 'landscape' | 'portrait' | 'square' | 'unknown';

export const detectOrientation = (width?: number, height?: number) => {
  if (!width || !height) return 'unknown' as Orientation;
  if (Math.abs(width - height) < Math.min(width, height) * 0.05) return 'square';
  return width > height ? 'landscape' : 'portrait';
};
