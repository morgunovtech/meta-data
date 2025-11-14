import { useEffect, useState } from 'react';
import type { ImageInfo } from './useImageFile';
import type { BasicExifData, MetadataGroups } from '@/types/exif';
import { computeCompleteness, countMetadataGroups } from '@/utils/metadata';

export type ExifState = {
  data?: BasicExifData;
  groups?: MetadataGroups;
  loading: boolean;
  error?: string;
};

export const useExifMetadata = (image?: ImageInfo) => {
  const [state, setState] = useState<ExifState>({ loading: false });

  useEffect(() => {
    if (!image) {
      setState({ loading: false });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setState({ loading: true });
      try {
        const { default: exifr } = await import('exifr');
        const groups: MetadataGroups = await exifr.parse(image.objectUrl, {
          xmp: true,
          iptc: true,
          icc: true,
          tiff: true,
          translateKeys: false
        });

        if (cancelled) return;
        const counts = countMetadataGroups(groups);
        const gpsRaw = groups?.exif as Record<string, unknown> | undefined;
        const gps = exifr.gps(groups) ?? undefined;
        const data: BasicExifData = {
          make: (groups.exif?.Make as string) ?? undefined,
          model: (groups.exif?.Model as string) ?? undefined,
          lensModel: (groups.exif?.LensModel as string) ?? undefined,
          dateTimeOriginal: (groups.exif?.DateTimeOriginal as string) ?? undefined,
          exposureTime: (groups.exif?.ExposureTime as string) ?? undefined,
          fNumber: (groups.exif?.FNumber as number) ?? undefined,
          iso: (groups.exif?.ISO as number) ?? undefined,
          focalLength: (groups.exif?.FocalLength as number) ?? undefined,
          focalLengthIn35mmFormat: (groups.exif?.FocalLengthIn35mmFilm as number) ?? undefined,
          software: (groups.exif?.Software as string) ?? undefined,
          gps: gps
            ? {
                latitude: gps.latitude,
                longitude: gps.longitude,
                altitude: gps.altitude ?? undefined,
                accuracyMeters:
                  (gpsRaw?.GPSHPositioningError as number) ??
                  (gpsRaw?.GPSDOP as number) ??
                  (gpsRaw?.GPSSpeed as number) ?? undefined,
                heading: (gpsRaw?.GPSImgDirection as number) ?? undefined
              }
            : undefined,
          counts,
          completeness: computeCompleteness({
            make: (groups.exif?.Make as string) ?? undefined,
            model: (groups.exif?.Model as string) ?? undefined,
            lensModel: (groups.exif?.LensModel as string) ?? undefined,
            dateTimeOriginal: (groups.exif?.DateTimeOriginal as string) ?? undefined,
            exposureTime: (groups.exif?.ExposureTime as string) ?? undefined,
            fNumber: (groups.exif?.FNumber as number) ?? undefined,
            iso: (groups.exif?.ISO as number) ?? undefined,
            focalLength: (groups.exif?.FocalLength as number) ?? undefined,
            gps: gps
              ? {
                  latitude: gps.latitude,
                  longitude: gps.longitude
                }
              : undefined
          })
        };

        setState({ loading: false, data, groups });
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to parse EXIF', error);
        setState({ loading: false, error: (error as Error).message });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [image]);

  return state;
};
