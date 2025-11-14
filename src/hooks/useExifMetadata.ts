import { useEffect, useState } from 'react';
import exifr from 'exifr';
import type { ParsedMetadata, ExifCore } from '../types/metadata';
import { scoreCompleteness } from '../utils/metadata';

interface Options {
  file: File | null;
}

export const useExifMetadata = ({ file }: Options) => {
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setMetadata(null);
      setError(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    setError(null);

    exifr
      .parse(file, { tiff: true, exif: true, gps: true, xmp: true, icc: true, iptc: true })
      .then((result: any) => {
        if (!isMounted) return;
        if (!result) {
          setMetadata(null);
          return;
        }
        const exif: ExifCore = {
          dateTimeOriginal: result.DateTimeOriginal ?? result.ModifyDate ?? undefined,
          offsetTimeOriginal: result.OffsetTimeOriginal ?? result.OffsetTime ?? undefined,
          make: result.Make ?? undefined,
          model: result.Model ?? undefined,
          lensModel: result.LensModel ?? result.LensSpecification ?? undefined,
          exposureTime: result.ExposureTime ? `1/${Math.round(1 / result.ExposureTime)}` : result.ShutterSpeedValue,
          fNumber: result.FNumber ?? undefined,
          iso: result.ISO ?? result.ISOSpeedRatings ?? undefined,
          focalLength: result.FocalLength ?? undefined,
          focalLength35mm: result.FocalLengthIn35mmFormat ?? undefined,
          gpsLatitude: result.latitude ?? result.GPSLatitude ?? undefined,
          gpsLongitude: result.longitude ?? result.GPSLongitude ?? undefined,
          gpsImgDirection: result.GPSImgDirection ?? undefined,
          gpsHPositioningError: result.GPSHPositioningError ?? undefined,
          gpsDop: result.GPSDOP ?? undefined,
          gpsSatellites: result.GPSSatellites ?? undefined
        };

        const counts = {
          exif: Object.keys(result.exif ?? {}).length,
          xmp: Object.keys(result.xmp ?? {}).length,
          iptc: Object.keys(result.iptc ?? {}).length,
          icc: Object.keys(result.icc ?? {}).length
        };

        setMetadata({
          counts,
          exif,
          completeness: scoreCompleteness(exif)
        });
      })
      .catch((ex: Error) => {
        if (!isMounted) return;
        setError(ex.message || 'exif');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [file]);

  return { metadata, error, loading };
};
