import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { BasicFileInfo } from '../types/metadata';

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_PIXEL_COUNT = 40_000_000; // guard overly large resolution that may crash canvases
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp'];

async function makeThumbnail(
  dataUrl: string,
  maxSize = 720
): Promise<{ url: string; width: number; height: number }> {
  const image = new Image();
  image.decoding = 'async';
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('image-load'));
  });
  const canvas = document.createElement('canvas');
  const longestSide = Math.max(image.width, image.height);
  const scale = Math.min(1, maxSize / longestSide);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.92);
  return { url, width: image.width, height: image.height };
}

export function useImageFile() {
  const t = useT();
  const [fileInfo, setFileInfo] = useState<BasicFileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => revokeObjectUrl, [revokeObjectUrl]);

  const reset = useCallback(() => {
    setFileInfo(null);
    setError(null);
    revokeObjectUrl();
  }, [revokeObjectUrl]);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      revokeObjectUrl();
      if (import.meta.env.DEV) {
        console.info('[pipeline] upload:start', { name: file.name, type: file.type, size: file.size });
      }
      try {
        if (file.size > MAX_SIZE_BYTES) {
          setError(t('fileTooLarge', { limit: 20 }));
          setLoading(false);
          return;
        }
        if (!SUPPORTED_TYPES.includes(file.type)) {
          if (file.name.toLowerCase().endsWith('.heic')) {
            setError(t('unsupportedHeic'));
          } else {
            setError(t('unsupportedFormat'));
          }
          setLoading(false);
          return;
        }
        const objectUrl = URL.createObjectURL(file);
        objectUrlRef.current = objectUrl;
        const { url: thumbnailUrl, width, height } = await makeThumbnail(objectUrl);
        const pixelCount = width * height;
        if (pixelCount > MAX_PIXEL_COUNT) {
          setError(t('fileTooLargeResolution'));
          setLoading(false);
          return;
        }
        const info: BasicFileInfo = {
          file,
          dataUrl: objectUrl,
          thumbnailUrl,
          width,
          height,
          aspectRatio: width / height,
          sizeBytes: file.size,
          mimeType: file.type
        };
        setFileInfo(info);
        if (import.meta.env.DEV) {
          console.info('[pipeline] upload:ready', { width, height, mime: file.type });
        }
      } catch (err) {
        console.error('file-processing', err);
        setError(t('corruptedFile'));
        revokeObjectUrl();
      } finally {
        setLoading(false);
      }
    },
    [revokeObjectUrl, t]
  );

  return {
    fileInfo,
    error,
    loading,
    processFile,
    reset
  };
}
