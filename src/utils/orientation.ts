import type { StructuredMetadata } from '../types/metadata';

export function inferOrientation(
  width: number,
  height: number,
  orientationTag?: number | string
): StructuredMetadata['orientation'] {
  let normalizedTag: number | undefined;
  if (typeof orientationTag === 'string') {
    const parsed = Number.parseInt(orientationTag, 10);
    if (Number.isFinite(parsed)) {
      normalizedTag = parsed;
    } else if (orientationTag.toLowerCase().includes('90')) {
      normalizedTag = 6;
    }
  } else {
    normalizedTag = orientationTag;
  }
  if (normalizedTag === 5 || normalizedTag === 6 || normalizedTag === 7 || normalizedTag === 8) {
    [width, height] = [height, width];
  }
  if (width === height) return 'square';
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'unknown';
}
