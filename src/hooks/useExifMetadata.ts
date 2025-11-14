import { useEffect, useMemo, useState } from 'react';
import exifr from 'exifr';
import { useT } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import { inferOrientation } from '../utils/orientation';
import { computeMetadataCompleteness } from '../utils/metadataScore';

type SectionedParseResult = Partial<
  Record<
    'ifd0' | 'ifd1' | 'ifd2' | 'tiff' | 'exif' | 'gps' | 'interop' | 'iptc' | 'xmp' | 'icc',
    Record<string, unknown>
  >
>;

type StandaloneGps = {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  accuracy?: number;
  horizontalAccuracy?: number;
  positionError?: number;
  bearing?: number;
  bearingRef?: string;
  imgDirection?: number;
  speed?: number;
  speedRef?: string;
};

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
        const [sectioned, xmpDataRaw, iptcDataRaw, iccDataRaw, gpsStandalone] = await Promise.all([
          exifr
            .parse(fileInfo.file, {
              tiff: true,
              ifd0: true,
              ifd1: true,
              ifd2: true,
              exif: true,
              gps: true,
              interop: true,
              iptc: true,
              xmp: true,
              icc: true,
              translateKeys: false,
              reviveValues: true,
              mergeOutput: false
            })
            .catch(() => undefined) as Promise<SectionedParseResult | undefined>,
          exifr.xmp(fileInfo.file).catch(() => undefined),
          exifr.iptc(fileInfo.file).catch(() => undefined),
          exifr.icc(fileInfo.file).catch(() => undefined),
          exifr.gps(fileInfo.file).catch(() => undefined)
        ]);

        if (!active) return;

        const exifCombined = mergeSections([
          sectioned?.ifd0,
          sectioned?.ifd1,
          sectioned?.ifd2,
          sectioned?.tiff,
          sectioned?.exif,
          sectioned?.gps,
          sectioned?.interop
        ]);

        const gpsSupplement = normalizeStandaloneGps(gpsStandalone);
        const exifRecord = mergeSections([exifCombined, gpsSupplement]);

        const xmpData = mergeSections([sectioned?.xmp, toRecord(xmpDataRaw)]);
        const iptcData = mergeSections([sectioned?.iptc, toRecord(iptcDataRaw)]);
        const iccData = mergeSections([sectioned?.icc, toRecord(iccDataRaw)]);

        const shotDateIso = normalizeDateValue(
          pickFirst(exifRecord, ['DateTimeOriginal', 'dateTimeOriginal', 'CreateDate', 'createDate']),
          pickFirst(exifRecord, [
            'OffsetTimeOriginal',
            'offsetTimeOriginal',
            'OffsetTime',
            'OffsetTimeDigitized',
            'offsetTimeDigitized'
          ])
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
        const gps = normalizeGps(exifRecord, sectioned?.gps, gpsSupplement);
        const orientationTag = pickFirst<number | string>(exifRecord, ['Orientation', 'orientation']);

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

function pickFirst<T>(source: Record<string, unknown> | undefined | null, keys: string[]): T | undefined {
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

function mergeSections(sections: Array<Record<string, unknown> | undefined | null>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const section of sections) {
    if (!section) continue;
    for (const [key, value] of Object.entries(section)) {
      if (value === undefined || value === null) continue;
      if (!(key in result)) {
        result[key] = value;
      }
    }
  }
  return result;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return { ...(value as Record<string, unknown>) };
}

function normalizeStandaloneGps(value: StandaloneGps | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const result: Record<string, unknown> = {};
  if (value.latitude != null) {
    result.latitude = value.latitude;
    result.lat = value.latitude;
  }
  if (value.longitude != null) {
    result.longitude = value.longitude;
    result.lon = value.longitude;
  }
  if (value.altitude != null) {
    result.altitude = value.altitude;
  }
  const accuracy = value.accuracy ?? value.horizontalAccuracy ?? value.positionError;
  if (accuracy != null) {
    result.accuracy = accuracy;
    result.gpsAccuracy = accuracy;
  }
  if (value.imgDirection != null) {
    result.imgDirection = value.imgDirection;
    result.gpsImgDirection = value.imgDirection;
    result.heading = value.imgDirection;
  }
  if (value.bearing != null) {
    result.bearing = value.bearing;
    if (result.gpsImgDirection == null) {
      result.gpsImgDirection = value.bearing;
    }
  }
  if (value.bearingRef != null) {
    result.bearingRef = value.bearingRef;
  }
  if (value.speed != null) {
    result.speed = value.speed;
    result.gpsSpeed = value.speed;
  }
  if (value.speedRef != null) {
    result.speedRef = value.speedRef;
    result.gpsSpeedRef = value.speedRef;
  }
  return result;
}

function normalizeDateValue(value: unknown, offsetValue?: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    const offset = normalizeOffset(offsetValue);
    const candidate = offset ? `${normalized}${offset}` : normalized;
    const parsed = new Date(candidate);
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

function normalizeGps(
  exifRecord: Record<string, unknown>,
  sectionGps?: Record<string, unknown>,
  standalone?: Record<string, unknown>
): StructuredMetadata['gps'] | undefined {
  const buckets = [sectionGps, standalone, exifRecord.gps as Record<string, unknown>, exifRecord].filter(
    (entry): entry is Record<string, unknown> => Boolean(entry)
  );

  const latRef = pickFromBuckets<string>(buckets, [
    'latRef',
    'latitudeRef',
    'GPSLatitudeRef',
    'gpsLatitudeRef',
    'LatitudeRef'
  ]);
  const lonRef = pickFromBuckets<string>(buckets, [
    'lonRef',
    'longitudeRef',
    'GPSLongitudeRef',
    'gpsLongitudeRef',
    'LongitudeRef'
  ]);
  const rawLat = pickFromBuckets(buckets, ['lat', 'latitude', 'GPSLatitude', 'gpsLatitude', 'Latitude']);
  const rawLon = pickFromBuckets(buckets, ['lon', 'longitude', 'GPSLongitude', 'gpsLongitude', 'Longitude']);
  const lat = toCoordinate(rawLat, latRef);
  const lon = toCoordinate(rawLon, lonRef);
  if (lat == null || lon == null) {
    return undefined;
  }

  const altitude = toNumber(pickFromBuckets(buckets, ['altitude', 'Altitude', 'GPSAltitude'])) ?? undefined;
  const accuracy =
    toNumber(
      pickFromBuckets(buckets, [
        'accuracy',
        'gpsAccuracy',
        'GPSAccuracy',
        'GPSHPositioningError',
        'gpsHPositioningError',
        'GPSDOP',
        'gpsDop',
        'positionError',
        'horizontalAccuracy'
      ])
    ) ?? undefined;
  const heading =
    toNumber(
      pickFromBuckets(buckets, ['heading', 'gpsImgDirection', 'GPSImgDirection', 'bearing', 'imgDirection'])
    ) ?? undefined;

  return {
    lat,
    lon,
    altitude,
    accuracy,
    heading
  };
}

function pickFromBuckets<T>(buckets: Array<Record<string, unknown>>, keys: string[]): T | undefined {
  for (const bucket of buckets) {
    const value = pickFirst<T>(bucket, keys);
    if (value != null) {
      return value;
    }
  }
  return undefined;
}

function normalizeOffset(offset: unknown): string | undefined {
  if (typeof offset !== 'string') return undefined;
  const trimmed = offset.trim();
  if (!/^[-+]\d{2}:?\d{2}$/.test(trimmed)) return undefined;
  const normalized = trimmed.includes(':') ? trimmed : `${trimmed.slice(0, 3)}:${trimmed.slice(3)}`;
  return normalized;
}

function toCoordinate(value: unknown, ref?: string | null): number | undefined {
  const numeric = toNumber(value);
  if (numeric == null) return undefined;
  if (!ref) return numeric;
  const upper = ref.toUpperCase();
  if (upper === 'S' || upper === 'W') {
    return -Math.abs(numeric);
  }
  return Math.abs(numeric);
}

function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return undefined;
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (Array.isArray(value)) {
    const numbers = value.map((entry) => rationalToNumber(entry)).filter((entry): entry is number => entry != null);
    if (numbers.length === 0) return undefined;
    if (numbers.length === 1) return numbers[0];
    if (numbers.length >= 3) {
      return numbers[0] + numbers[1] / 60 + numbers[2] / 3600;
    }
    return numbers.reduce((acc, item) => acc + item, 0);
  }
  return rationalToNumber(value);
}

function rationalToNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === 'object' && 'numerator' in (value as any) && 'denominator' in (value as any)) {
    const numerator = Number((value as any).numerator);
    const denominator = Number((value as any).denominator);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return undefined;
    }
    return numerator / denominator;
  }
  return undefined;
}
