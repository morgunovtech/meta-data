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
        const [
          exifResult,
          xmpResult,
          iptcResult,
          iccResult,
          gpsResult
        ] = await Promise.allSettled([
          exifr.parse(fileInfo.file, {
            exif: true,
            gps: true,
            translateKeys: true
          }),
          exifr.xmp(fileInfo.file),
          exifr.iptc(fileInfo.file),
          exifr.icc(fileInfo.file),
          exifr.gps(fileInfo.file)
        ]);

        if (!active) return;

        const exifRecord = toRecord(exifResult);
        const xmpData = toRecord(xmpResult);
        const iptcData = toRecord(iptcResult);
        const iccData = toRecord(iccResult);
        const gpsRaw = toRecord(gpsResult);
        augmentExifWithGps(exifRecord, gpsRaw);

        const shotDateIso = normalizeDateValue(
          pickFirst(exifRecord, ['DateTimeOriginal', 'dateTimeOriginal', 'CreateDate', 'createDate']),
          pickFirst(exifRecord, ['OffsetTimeOriginal', 'offsetTimeOriginal', 'OffsetTime'])
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
        const gps = normalizeGps(exifRecord, gpsRaw);
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

function augmentExifWithGps(exif: Record<string, unknown>, gps: Record<string, unknown>) {
  if (!gps || Object.keys(gps).length === 0) return;
  const ensureGpsContainer = () => {
    const existing = exif['gps'];
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      return existing as Record<string, unknown>;
    }
    const created: Record<string, unknown> = {};
    exif['gps'] = created;
    return created;
  };
  const gpsContainer = ensureGpsContainer();
  const assign = (targets: string[], sourceKeys: string[]) => {
    const value = pickFirst(gps, sourceKeys);
    if (value == null) return;
    for (const key of targets) {
      if (exif[key] == null) {
        exif[key] = value;
      }
      if (gpsContainer[key] == null) {
        gpsContainer[key] = value;
      }
    }
    for (const key of sourceKeys) {
      if (gpsContainer[key] == null) {
        gpsContainer[key] = value;
      }
    }
  };

  assign(['GPSLatitude', 'gpsLatitude', 'latitude'], ['latitude', 'lat']);
  assign(['GPSLongitude', 'gpsLongitude', 'longitude'], ['longitude', 'lon']);
  assign(['GPSLatitudeRef', 'LatitudeRef', 'latRef'], ['latitudeRef', 'latRef']);
  assign(['GPSLongitudeRef', 'LongitudeRef', 'lonRef'], ['longitudeRef', 'lonRef']);
  assign(['GPSAltitude', 'Altitude', 'altitude'], ['altitude']);
  assign(['GPSHPositioningError', 'gpsHPositioningError', 'GPSDOP', 'gpsAccuracy'], ['accuracy', 'dop', 'hdop', 'hPositioningError']);
  assign(['GPSSpeed', 'gpsSpeed', 'Speed', 'GPSSpeedRaw'], ['speed']);
  assign(['GPSSpeedRef', 'gpsSpeedRef'], ['speedRef']);
  assign(['GPSImgDirection', 'gpsImgDirection', 'imgDirection', 'heading'], ['imgDirection', 'heading']);
}

function normalizeGps(
  exifRecord: Record<string, unknown>,
  fallback: Record<string, unknown>
): StructuredMetadata['gps'] | undefined {
  const gpsRecord = (exifRecord.gps as Record<string, unknown> | undefined) ?? {};
  const fallbackRecord = fallback ?? {};
  const combined: Record<string, unknown> = { ...gpsRecord };

  for (const [key, value] of Object.entries(fallbackRecord)) {
    if (combined[key] == null && value != null) {
      combined[key] = value;
    }
  }

  const latRef =
    pickFirst<string>(combined, ['latRef', 'latitudeRef', 'GPSLatitudeRef']) ??
    pickFirst<string>(exifRecord, ['GPSLatitudeRef', 'gpsLatitudeRef', 'LatitudeRef']) ??
    pickFirst<string>(fallbackRecord, ['latRef', 'latitudeRef']);
  const lonRef =
    pickFirst<string>(combined, ['lonRef', 'longitudeRef', 'GPSLongitudeRef']) ??
    pickFirst<string>(exifRecord, ['GPSLongitudeRef', 'gpsLongitudeRef', 'LongitudeRef']) ??
    pickFirst<string>(fallbackRecord, ['lonRef', 'longitudeRef']);

  const rawLat =
    pickFirst(combined, ['lat', 'latitude', 'GPSLatitude']) ??
    pickFirst(exifRecord, ['latitude', 'Latitude', 'GPSLatitude']) ??
    pickFirst(fallbackRecord, ['latitude', 'lat']);
  const rawLon =
    pickFirst(combined, ['lon', 'longitude', 'GPSLongitude']) ??
    pickFirst(exifRecord, ['longitude', 'Longitude', 'GPSLongitude']) ??
    pickFirst(fallbackRecord, ['longitude', 'lon']);

  const lat =
    toCoordinate(rawLat, latRef) ??
    (fallbackRecord ? toNumber(pickFirst(fallbackRecord, ['latitude', 'lat'])) : undefined);
  const lon =
    toCoordinate(rawLon, lonRef) ??
    (fallbackRecord ? toNumber(pickFirst(fallbackRecord, ['longitude', 'lon'])) : undefined);

  if (lat == null || lon == null) {
    return undefined;
  }

  const altitude =
    toNumber(
      pickFirst(combined, ['altitude', 'Altitude']) ??
        pickFirst(exifRecord, ['Altitude']) ??
        pickFirst(fallbackRecord, ['altitude'])
    ) ?? undefined;
  const accuracy =
    toNumber(
      pickFirst(combined, ['accuracy', 'gpsAccuracy']) ??
        pickFirst(exifRecord, ['gpsAccuracy', 'gpsHPositioningError', 'GPSHPositioningError', 'GPSDOP']) ??
        pickFirst(fallbackRecord, ['accuracy', 'hPositioningError', 'dop', 'hdop'])
    ) ?? undefined;
  const heading =
    toNumber(
      pickFirst(combined, ['heading', 'gpsImgDirection']) ??
        pickFirst(exifRecord, ['gpsImgDirection', 'GPSImgDirection']) ??
        pickFirst(fallbackRecord, ['heading', 'imgDirection'])
    ) ?? undefined;

  return {
    lat,
    lon,
    altitude,
    accuracy,
    heading
  };
}

function toRecord(result: PromiseSettledResult<unknown>): Record<string, unknown> {
  if (result.status !== 'fulfilled') {
    return {};
  }
  const value = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return { ...(value as Record<string, unknown>) };
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
