export type GpsMetadata = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracyMeters?: number;
  heading?: number;
};

export type BasicExifData = {
  make?: string;
  model?: string;
  lensModel?: string;
  dateTimeOriginal?: string;
  timeZone?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  focalLengthIn35mmFormat?: number;
  software?: string;
  gps?: GpsMetadata;
  counts: {
    exif: number;
    xmp: number;
    iptc: number;
    icc: number;
  };
  completeness: number;
};

export type MetadataGroups = {
  exif?: Record<string, unknown>;
  xmp?: Record<string, unknown>;
  iptc?: Record<string, unknown>;
  icc?: Record<string, unknown>;
};
