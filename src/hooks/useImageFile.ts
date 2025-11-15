import { useCallback, useState } from 'react';
import { useT } from '../i18n';
import type { BasicFileInfo } from '../types/metadata';

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-error'));
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}

async function makeThumbnail(dataUrl: string, maxSize = 720): Promise<{ url: string; width: number; height: number }> {
  const image = new Image();
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

  const reset = useCallback(() => {
    setFileInfo(null);
    setError(null);
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
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
        const dataUrl = await fileToDataUrl(file);
        const { url: thumbnailUrl, width, height } = await makeThumbnail(dataUrl);
        const info: BasicFileInfo = {
          file,
          dataUrl,
          thumbnailUrl,
          width,
          height,
          aspectRatio: width / height,
          sizeBytes: file.size,
          mimeType: file.type
        };
        setFileInfo(info);
      } catch (err) {
        console.error('file-processing', err);
        setError(t('corruptedFile'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  return {
    fileInfo,
    error,
    loading,
    processFile,
    reset
  };
}
