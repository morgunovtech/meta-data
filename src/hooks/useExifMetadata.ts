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

        const gps = exifData?.gps || (exifData?.latitude && exifData?.longitude
          ? {
              lat: exifData.latitude,
              lon: exifData.longitude,
              altitude: exifData.altitude,
              accuracy: exifData.gpsAccuracy || exifData.gpsHPositioningError,
              heading: exifData.gpsImgDirection
            }
          : undefined);

        const structured: StructuredMetadata = {
          groups: {
            exif: exifData ?? {},
            xmp: xmpData,
            iptc: iptcData,
            icc: iccData
          },
          shotDate: exifData?.DateTimeOriginal || exifData?.CreateDate,
          cameraMake: exifData?.Make,
          cameraModel: exifData?.Model,
          lensModel: exifData?.LensModel,
          exposureTime: exifData?.ExposureTime ? `1/${Math.round(1 / exifData.ExposureTime)}` : undefined,
          aperture: exifData?.FNumber,
          iso: exifData?.ISO,
          focalLength: exifData?.FocalLength,
          focalLength35mm: exifData?.FocalLengthIn35mmFormat,
          gps,
          completeness: computeMetadataCompleteness({
            shotDate: exifData?.DateTimeOriginal,
            cameraMake: exifData?.Make,
            cameraModel: exifData?.Model,
            lensModel: exifData?.LensModel,
            exposureTime: exifData?.ExposureTime,
            aperture: exifData?.FNumber,
            iso: exifData?.ISO,
            focalLength: exifData?.FocalLength,
            gps
          }),
          orientation: inferOrientation(fileInfo.width, fileInfo.height, exifData?.Orientation)
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
