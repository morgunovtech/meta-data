import { useCallback, useMemo, useState } from 'react';
import { MAX_FILE_SIZE_BYTES, isSupportedType } from '@/utils/file';
import { detectOrientation, Orientation } from '@/utils/orientation';

export type ImageInfo = {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  orientation: Orientation;
  megapixels: number;
  objectUrl: string;
  thumbnailUrl: string;
};

export type ImageFileError = 'too_large' | 'unsupported' | 'corrupted' | 'heic';

export const useImageFile = () => {
  const [info, setInfo] = useState<ImageInfo | undefined>();
  const [error, setError] = useState<ImageFileError | undefined>();
  const [loading, setLoading] = useState(false);

  const clear = useCallback(() => {
    if (info?.objectUrl) URL.revokeObjectURL(info.objectUrl);
    setInfo(undefined);
    setError(undefined);
  }, [info?.objectUrl]);

  const processImage = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });
    const objectUrl = URL.createObjectURL(blob);

    const bitmap = await createImageBitmap(blob).catch(async () => {
      return new Promise<ImageBitmap>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas unsupported'));
            return;
          }
          ctx.drawImage(image, 0, 0);
          createImageBitmap(canvas)
            .then(resolve)
            .catch(reject);
        };
        image.onerror = () => reject(new Error('load failed'));
        image.src = objectUrl;
      });
    });

    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, 0.25 * Math.max(bitmap.width, bitmap.height) / maxSide);
    const thumbWidth = Math.round(bitmap.width * scale);
    const thumbHeight = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unsupported');
    ctx.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
      orientation: detectOrientation(bitmap.width, bitmap.height),
      megapixels: Number(((bitmap.width * bitmap.height) / 1_000_000).toFixed(2)),
      objectUrl,
      thumbnailUrl
    } satisfies ImageInfo;
  };

  const selectFile = useCallback(async (file: File) => {
    setError(undefined);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('too_large');
      return;
    }
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      setError('heic');
      return;
    }
    if (!isSupportedType(file.type)) {
      setError('unsupported');
      return;
    }

    setLoading(true);
    try {
      const result = await processImage(file);
      setInfo((prev) => {
        if (prev?.objectUrl && prev.objectUrl !== result.objectUrl) {
          URL.revokeObjectURL(prev.objectUrl);
        }
        return result;
      });
    } catch (err) {
      console.error('Failed to process image', err);
      setError('corrupted');
      setInfo(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  const infoWithStats = useMemo(() => info, [info]);

  return {
    info: infoWithStats,
    error,
    loading,
    selectFile,
    clear
  };
};
