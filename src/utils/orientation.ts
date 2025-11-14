import type { StructuredMetadata } from '../types/metadata';

export function inferOrientation(
  width: number,
  height: number,
  orientationTag?: number | string
): StructuredMetadata['orientation'] {
  if (shouldSwapDimensions(orientationTag)) {
    [width, height] = [height, width];
  }
  if (width === height) return 'square';
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'unknown';
}

function shouldSwapDimensions(tag?: number | string): boolean {
  if (typeof tag === 'number') {
    return [5, 6, 7, 8].includes(tag);
  }
  if (typeof tag === 'string') {
    const normalized = tag.toLowerCase();
    return normalized.includes('90') || normalized.includes('rotate');
  }
  return false;
}
