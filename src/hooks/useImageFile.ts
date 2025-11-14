import { useCallback, useState } from 'react';
import { calculateMegapixels, detectOrientation, formatBytes, MAX_FILE_SIZE_MB } from '../utils/file';
import { useI18n } from '../i18n/I18nContext';
import type { Orientation } from '../types/metadata';
import type { PreviewData } from '../components/PreviewViewer';

export type ImageFileInfo = {
  file?: File;
  name?: string;
  size?: number;
  formattedSize?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  megapixels?: number;
  orientation?: Orientation;
};

export type ImageFileState = {
  info: ImageFileInfo;
  preview?: PreviewData;
  error?: string;
  loading: boolean;
};

export function useImageFile() {
  const { t } = useI18n();
  const [state, setState] = useState<ImageFileState>({ info: {}, loading: false });

  const readImage = useCallback(
    async (file: File) => {
      setState({ info: {}, loading: true });

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
        setState({ info: {}, error: t('unsupportedFormat'), loading: false });
        return;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setState({ info: {}, error: t('tooLarge', { limit: MAX_FILE_SIZE_MB }), loading: false });
        return;
      }

      try {
        await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('read-error'));
          reader.readAsDataURL(file);
        });

        const image = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 512 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.85);

        const info: ImageFileInfo = {
          file,
          name: file.name,
          size: file.size,
          formattedSize: formatBytes(file.size),
          mimeType: file.type,
          width: image.width,
          height: image.height,
          megapixels: calculateMegapixels(image.width, image.height),
          orientation: detectOrientation(image.width, image.height)
        };

        setState({
          info,
          preview: {
            dataUrl: thumbnail,
            width: canvas.width,
            height: canvas.height
          },
          error: undefined,
          loading: false
        });
      } catch (error) {
        console.error('image-read-failed', error);
        setState({ info: {}, error: t('corrupted'), loading: false });
      }
    },
    [t]
  );

  return {
    state,
    readImage
  };
}
