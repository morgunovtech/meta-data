import type { BasicExifData, MetadataGroups } from '@/types/exif';

const completenessKeys: (keyof BasicExifData)[] = [
  'dateTimeOriginal',
  'make',
  'model',
  'lensModel',
  'fNumber',
  'exposureTime',
  'iso',
  'focalLength'
];

export const computeCompleteness = (data: Partial<BasicExifData>) => {
  const total = completenessKeys.length + 2; // include GPS lat/lon as two fields
  let filled = completenessKeys.filter((key) => !!data[key]).length;
  if (data.gps?.latitude && data.gps?.longitude) {
    filled += 2;
  }
  return Math.round((filled / total) * 100);
};

export const countMetadataGroups = (groups: MetadataGroups) => ({
  exif: Object.keys(groups.exif ?? {}).length,
  xmp: Object.keys(groups.xmp ?? {}).length,
  iptc: Object.keys(groups.iptc ?? {}).length,
  icc: Object.keys(groups.icc ?? {}).length
});

export const buildProcessingChainHint = (data: BasicExifData, groups: MetadataGroups) => {
  const hints: string[] = [];
  if (data.model) hints.push(data.model);
  if (data.software) hints.push(data.software);
  if (groups.xmp && Object.keys(groups.xmp).length) hints.push('XMP editor');
  if (groups.iptc && Object.keys(groups.iptc).length) hints.push('IPTC metadata');
  if (hints.length <= 1) return undefined;
  return hints.join(' → ');
};
