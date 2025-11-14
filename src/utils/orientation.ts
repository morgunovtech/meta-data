import type { StructuredMetadata } from '../types/metadata';

export function inferOrientation(width: number, height: number, orientationTag?: number): StructuredMetadata['orientation'] {
  if (orientationTag === 6 || orientationTag === 8) {
    [width, height] = [height, width];
  }
  if (width === height) return 'square';
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'unknown';
}
