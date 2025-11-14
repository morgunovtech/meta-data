export type Orientation = 'portrait' | 'landscape' | 'square';

export type MetadataGroupCounts = {
  exif: number;
  xmp: number;
  iptc: number;
  icc: number;
};

export type CameraMetadata = {
  make?: string;
  model?: string;
  lensModel?: string;
  exposureTime?: string;
  aperture?: number;
  iso?: number;
  focalLength?: number;
  focalLength35?: number;
  software?: string;
  dateTimeOriginal?: string;
  offsetTime?: string;
};

export type GpsMetadata = {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
};

export type MetadataCompleteness = {
  percentage: number;
  missingFields: string[];
};

export type ParsedMetadata = {
  groups: MetadataGroupCounts;
  camera: CameraMetadata;
  gps: GpsMetadata;
  completeness: MetadataCompleteness;
};
