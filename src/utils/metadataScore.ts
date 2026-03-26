import type { StructuredMetadata } from '../types/metadata';

const REQUIRED_FIELDS = [
  'shotDate',
  'cameraMake',
  'cameraModel',
  'lensModel',
  'exposureTime',
  'aperture',
  'iso',
  'focalLength'
] as const;

export function computeMetadataCompleteness(meta: Partial<StructuredMetadata>): number {
  let filled = 0;
  REQUIRED_FIELDS.forEach((key) => {
    if (meta[key] != null) {
      filled += 1;
    }
  });
  if (meta.gps?.lat != null && meta.gps?.lon != null) {
    filled += 1;
  }
  return filled / (REQUIRED_FIELDS.length + 1);
}
