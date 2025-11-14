import { useEffect, useMemo, useState } from 'react';
import exifr from 'exifr';
import { useT } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import { inferOrientation } from '../utils/orientation';
import { computeMetadataCompleteness } from '../utils/metadataScore';

interface UseExifMetadataResult {
  metadata: StructuredMetadata | null;
  loading: boolean;
  error: string | null;
}

export function useExifMetadata(fileInfo: BasicFileInfo | null): UseExifMetadataResult {
  const t = useT();
  const [metadata, setMetadata] = useState<StructuredMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!fileInfo) {
      setMetadata(null);
      setError(null);
      return;
    }

    const parse = async () => {
      setLoading(true);
      setError(null);
      try {
        const exifData = await exifr.parse(fileInfo.file, {
          exif: true,
          gps: true,
          translateKeys: true
        });
        const xmpData = (await exifr.xmp(fileInfo.file)) ?? {};
        const iptcData = (await exifr.iptc(fileInfo.file)) ?? {};
        const iccData = (await exifr.icc(fileInfo.file)) ?? {};

        if (!active) return;

        const exifRecord = (exifData ?? {}) as Record<string, unknown>;
        const shotDateIso = normalizeDateValue(
          pickFirst(exifRecord, ['DateTimeOriginal', 'dateTimeOriginal', 'CreateDate', 'createDate'])
        );
        const cameraMake = pickFirst<string>(exifRecord, ['Make', 'make']);
        const cameraModel = pickFirst<string>(exifRecord, ['Model', 'model']);
        const lensModel = pickFirst<string>(exifRecord, ['LensModel', 'lensModel']);
        const rawExposure = pickFirst<string | number>(exifRecord, ['ExposureTime', 'exposureTime']);
        const exposureTime = formatExposure(rawExposure);
        const aperture = pickFirst<number>(exifRecord, ['FNumber', 'fNumber']);
        const iso = pickFirst<number>(exifRecord, ['ISO', 'iso']);
        const focalLength = pickFirst<number>(exifRecord, ['FocalLength', 'focalLength']);
        const focalLength35mm = pickFirst<number>(exifRecord, ['FocalLengthIn35mmFormat', 'focalLengthIn35MmFormat']);
        const gps = normalizeGps(exifRecord);
        const orientationTagRaw = pickFirst<number | string>(exifRecord, ['Orientation', 'orientation']);
        const orientationTag = normalizeOrientationTag(orientationTagRaw);

        const structured: StructuredMetadata = {
          groups: {
            exif: exifRecord,
            xmp: xmpData,
            iptc: iptcData,
            icc: iccData
          },
          shotDate: shotDateIso,
          cameraMake,
          cameraModel,
          lensModel,
          exposureTime,
          aperture,
          iso,
          focalLength,
          focalLength35mm,
          gps,
          completeness: computeMetadataCompleteness({
            shotDate: shotDateIso,
            cameraMake,
            cameraModel,
            lensModel,
            exposureTime: rawExposure,
            aperture,
            iso,
            focalLength,
            gps
          }),
          orientation: inferOrientation(fileInfo.width, fileInfo.height, orientationTag)
        };

        setMetadata(structured);
      } catch (err) {
        console.error('metadata-parse', err);
        setError(t('corruptedFile'));
        setMetadata(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    parse();

    return () => {
      active = false;
    };
  }, [fileInfo, t]);

  const resultError = useMemo(() => error, [error]);

  return { metadata, loading, error: resultError };
}

function pickFirst<T>(source: Record<string, unknown> | undefined, keys: string[]): T | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    if (key in source) {
      const value = source[key];
      if (value != null) {
        return value as T;
      }
    }
  }
  return undefined;
}

function normalizeDateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function formatExposure(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    return value;
  }
  if (value <= 0) return undefined;
  if (value >= 1) {
    return value.toFixed(2);
  }
  const reciprocal = Math.round(1 / value);
  return `1/${reciprocal}`;
}

function normalizeGps(exifRecord: Record<string, unknown>): StructuredMetadata['gps'] | undefined {
  const gpsRecord = (exifRecord.gps as Record<string, unknown> | undefined) ?? {};
  const lat =
    pickFirst<number>(gpsRecord, ['lat', 'latitude']) ??
    pickFirst<number>(exifRecord, ['latitude', 'Latitude', 'GPSLatitude']);
  const lon =
    pickFirst<number>(gpsRecord, ['lon', 'longitude']) ??
    pickFirst<number>(exifRecord, ['longitude', 'Longitude', 'GPSLongitude']);
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
    return undefined;
  }
  const altitude = pickFirst<number>(gpsRecord, ['altitude', 'Altitude']) ?? pickFirst<number>(exifRecord, ['Altitude']);
  const accuracy =
    pickFirst<number>(gpsRecord, ['accuracy', 'gpsAccuracy']) ??
    pickFirst<number>(exifRecord, ['gpsAccuracy', 'gpsHPositioningError', 'GPSHPositioningError', 'GPSDOP']);
  const heading =
    pickFirst<number>(gpsRecord, ['heading', 'gpsImgDirection']) ??
    pickFirst<number>(exifRecord, ['gpsImgDirection', 'GPSImgDirection']);
  return {
    lat,
    lon,
    altitude,
    accuracy,
    heading
  };
}

function normalizeOrientationTag(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const asNumber = Number.parseInt(trimmed, 10);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
    const mapping: Record<string, number> = {
      'horizontal (normal)': 1,
      'mirror horizontal': 2,
      'rotate 180': 3,
      'mirror vertical': 4,
      'mirror horizontal and rotate 270 cw': 5,
      'rotate 90 cw': 6,
      'mirror horizontal and rotate 90 cw': 7,
      'rotate 270 cw': 8
    };
    const normalized = trimmed.toLowerCase();
    return mapping[normalized];
  }
  return undefined;
}
