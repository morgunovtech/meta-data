import type { ExifCore, MetadataCompleteness } from '../types/metadata';

const completenessKeys: Array<keyof ExifCore> = [
  'dateTimeOriginal',
  'make',
  'model',
  'lensModel',
  'fNumber',
  'exposureTime',
  'iso',
  'focalLength',
  'gpsLatitude',
  'gpsLongitude'
];

export const scoreCompleteness = (exif: ExifCore): MetadataCompleteness => {
  const presentKeys: string[] = [];
  const missingKeys: string[] = [];
  completenessKeys.forEach((key) => {
    const value = exif[key];
    if (value === undefined || value === null || value === '') {
      missingKeys.push(key);
    } else {
      presentKeys.push(key);
    }
  });
  const percent = completenessKeys.length === 0 ? 0 : Math.round((presentKeys.length / completenessKeys.length) * 100);
  return { percent, missingKeys, presentKeys };
};
