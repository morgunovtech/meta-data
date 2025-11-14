import { useEffect, useMemo, useState } from 'react';
import * as exifr from 'exifr';
import type { ParsedMetadata } from '../types/metadata';
import { calculateCompleteness } from '../utils/metadata';
import { useI18n } from '../i18n/I18nContext';

export type ExifState = {
  metadata?: ParsedMetadata;
  loading: boolean;
  error?: string;
  raw?: Record<string, unknown>;
};

export function useExifMetadata(file?: File): ExifState {
  const { t } = useI18n();
  const [state, setState] = useState<ExifState>({ loading: false });

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setState({ loading: false });
      return () => {
        cancelled = true;
      };
    }

    setState({ loading: true });

    exifr
      .parse(file, { exif: true, xmp: true, iptc: true, icc: true })
      .then((result) => {
        if (cancelled) return;
        const groups = {
          exif: Object.keys(result?.exif ?? {}).length,
          xmp: Object.keys(result?.xmp ?? {}).length,
          iptc: Object.keys(result?.iptc ?? {}).length,
          icc: Object.keys(result?.icc ?? {}).length
        };

        const tags = result?.exif ?? {};
        const camera = {
          make: tags.Make as string | undefined,
          model: tags.Model as string | undefined,
          lensModel: (tags.LensModel ?? tags.LensMake) as string | undefined,
          exposureTime: tags.ExposureTime ? `1/${Math.round(1 / Number(tags.ExposureTime))}` : undefined,
          aperture: Number(tags.FNumber) || undefined,
          iso: Number(tags.ISO) || undefined,
          focalLength: Number(tags.FocalLength) || undefined,
          focalLength35: Number(tags.FocalLengthIn35mmFilm) || undefined,
          software: (tags.Software ?? tags.ProcessingSoftware) as string | undefined,
          dateTimeOriginal: (tags.DateTimeOriginal ?? tags.CreateDate) as string | undefined,
          offsetTime: (tags.OffsetTimeOriginal ?? tags.OffsetTime) as string | undefined
        };

        const gpsTags = result?.gps ?? result?.exif ?? {};
        const gps = {
          latitude: gpsTags.GPSLatitude as number | undefined,
          longitude: gpsTags.GPSLongitude as number | undefined,
          altitude: gpsTags.GPSAltitude as number | undefined,
          accuracy:
            (gpsTags.GPSHPositioningError as number | undefined) ??
            (gpsTags.GPSDOP as number | undefined),
          heading: gpsTags.GPSImgDirection as number | undefined
        };

        const completeness = calculateCompleteness(result?.exif ?? {});

        const parsed: ParsedMetadata = {
          groups,
          camera,
          gps,
          completeness
        };

        setState({ metadata: parsed, loading: false, raw: result as Record<string, unknown> });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('exif-parse-failed', error);
        setState({ loading: false, error: t('corrupted') });
      });

    return () => {
      cancelled = true;
    };
  }, [file, t]);

  return useMemo(() => state, [state]);
}
