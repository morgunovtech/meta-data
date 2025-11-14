import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { detectOrientation } from '../utils/image';
import type { BasicFileInfo } from '../types/metadata';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImageState {
  file: File | null;
  basicInfo: BasicFileInfo | null;
  dataUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  loading: boolean;
}

export const useImageFile = () => {
  const [state, setState] = useState<ImageState>({
    file: null,
    basicInfo: null,
    dataUrl: null,
    thumbnailUrl: null,
    error: null,
    loading: false
  });

  const reset = useCallback(() => {
    setState({
      file: null,
      basicInfo: null,
      dataUrl: null,
      thumbnailUrl: null,
      error: null,
      loading: false
    });
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setState((prev) => ({ ...prev, error: 'too_large' }));
      return;
    }
    if (!SUPPORTED_TYPES.includes(file.type)) {
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        setState((prev) => ({ ...prev, error: 'heic' }));
        return;
      }
      setState((prev) => ({ ...prev, error: 'bad_type' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const reader = new FileReader();
    const readPromise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('corrupt'));
    });
    reader.readAsDataURL(file);

    try {
      const dataUrl = await readPromise;
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('corrupt'));
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('canvas');
      }
      const longest = Math.max(image.width, image.height);
      const scale = Math.min(1, 0.25 * (longest ? (longest / longest) : 1));
      const targetWidth = Math.round(image.width * scale);
      const targetHeight = Math.round(image.height * scale);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);

      const basicInfo: BasicFileInfo = {
        name: file.name,
        type: file.type,
        sizeBytes: file.size,
        width: image.width,
        height: image.height,
        orientation: detectOrientation(image.width, image.height)
      };

      setState({
        file,
        basicInfo,
        dataUrl,
        thumbnailUrl,
        error: null,
        loading: false
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'corrupt';
      setState({
        file: null,
        basicInfo: null,
        dataUrl: null,
        thumbnailUrl: null,
        error: message,
        loading: false
      });
    }
  }, []);

  const inputProps = useMemo(
    () => ({
      accept: SUPPORTED_TYPES.join(','),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) processFile(file);
      }
    }),
    [processFile]
  );

  return {
    ...state,
    setFile: processFile,
    reset,
    inputProps
  };
};
