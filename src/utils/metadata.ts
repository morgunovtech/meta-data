import type { MetadataCompleteness } from '../types/metadata';

const REQUIRED_FIELDS = [
  'DateTimeOriginal',
  'Make',
  'Model',
  'LensModel',
  'FNumber',
  'ExposureTime',
  'ISO',
  'FocalLength',
  'GPSLatitude',
  'GPSLongitude'
];

export function calculateCompleteness(tags: Record<string, unknown>): MetadataCompleteness {
  const missing: string[] = [];
  let filled = 0;
  REQUIRED_FIELDS.forEach((field) => {
    if (tags[field] !== undefined && tags[field] !== null) {
      filled += 1;
    } else {
      missing.push(field);
    }
  });
  const percentage = Math.round((filled / REQUIRED_FIELDS.length) * 100);
  return { percentage, missingFields: missing };
}
