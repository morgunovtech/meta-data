import React, { useState } from 'react';
import type { ImageInfo } from '@/hooks/useImageFile';
import type { DetectedObject } from '@/types/analysis';
import { useI18n } from '@/i18n/I18nContext';

export type CleanupDownloadBlockProps = {
  image?: ImageInfo;
  detections: DetectedObject[];
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({ image, detections }) => {
  const { t } = useI18n();
  const [stripMetadata, setStripMetadata] = useState(true);
  const [blurFaces, setBlurFaces] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [status, setStatus] = useState<string | undefined>();

  const handleDownload = async () => {
    if (!image) return;
    if (!stripMetadata && !blurFaces) return;
    setStatus(undefined);
    try {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = image.objectUrl;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unsupported');
      ctx.drawImage(img, 0, 0);

      if (blurFaces) {
        detections
          .filter((det) => det.label.includes('person'))
          .forEach((det) => {
            const { left, top, width, height } = det.box;
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, width, height);
            ctx.clip();
            ctx.filter = 'blur(18px)';
            ctx.drawImage(img, 0, 0);
            ctx.restore();
          });
      }

      const mime = image.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const exportQuality = mime === 'image/jpeg' ? quality : undefined;
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (created) => {
            if (created) resolve(created);
            else reject(new Error('failed to encode image'));
          },
          mime,
          exportQuality
        );
      });

      const cleanedName = image.name.replace(/\.[^.]+$/, mime === 'image/png' ? '.cleaned.png' : '.cleaned.jpg');
      downloadBlob(blob, cleanedName);
      setStatus(t('cleanup_ready'));
    } catch (error) {
      console.error('cleanup failed', error);
      setStatus(t('cleanup_error', { error: (error as Error).message }));
    }
  };

  return (
    <section className="cleanup-block">
      <h2>{t('cleanup_title')}</h2>
      <label className="toggle">
        <input type="checkbox" checked={stripMetadata} onChange={(event) => setStripMetadata(event.target.checked)} />
        <span>{t('cleanup_remove_meta')}</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={blurFaces} onChange={(event) => setBlurFaces(event.target.checked)} />
        <span>{t('cleanup_blur_faces')}</span>
      </label>
      {image?.type === 'image/jpeg' && (
        <label className="slider">
          <span>{t('cleanup_quality')}</span>
          <input
            type="range"
            min={0.7}
            max={1}
            step={0.01}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />
          <span>{quality.toFixed(2)}</span>
        </label>
      )}
      <button type="button" onClick={handleDownload} disabled={!image || (!stripMetadata && !blurFaces)}>
        {t('cleanup_download')}
      </button>
      {status && <p>{status}</p>}
    </section>
  );
};
