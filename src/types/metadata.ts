export interface BasicFileInfo {
  name: string;
  type: string;
  sizeBytes: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
}

export interface MetadataGroupCounts {
  exif: number;
  xmp: number;
  iptc: number;
  icc: number;
}

export interface ExifCore {
  dateTimeOriginal?: string;
  offsetTimeOriginal?: string;
  make?: string;
  model?: string;
  lensModel?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  focalLength35mm?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsImgDirection?: number;
  gpsHPositioningError?: number;
  gpsDop?: number;
  gpsSatellites?: number;
}

export interface MetadataCompleteness {
  percent: number;
  missingKeys: string[];
  presentKeys: string[];
}

export interface ParsedMetadata {
  counts: MetadataGroupCounts;
  exif: ExifCore;
  completeness: MetadataCompleteness;
}

export interface ManualCoordinates {
  latitude: number;
  longitude: number;
}
