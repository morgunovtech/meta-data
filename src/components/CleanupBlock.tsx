import React, { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { DetectionSummary } from '../types/detection';
import type { ReturnTypeUseImageFile } from './componentTypes';
import { clampQuality } from '../utils/image';

interface Props {
  hasImage: boolean;
  summary: DetectionSummary | null;
  quality: number;
  setQuality: (value: number) => void;
  image: ReturnTypeUseImageFile;
}

const CleanupBlock: React.FC<Props> = ({ hasImage, summary, quality, setQuality, image }) => {
  const { t } = useLanguage();
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [blurFaces, setBlurFaces] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boxesToBlur = useMemo(() => {
    if (!summary) return [];
    return summary.boxes.filter((box) => box.label.toLowerCase().includes('person'));
  }, [summary]);

  const handleDownload = async () => {
    if (!hasImage || !image.dataUrl) return;
    setError(null);
    setDownloading(true);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('load_failed'));
        el.src = image.dataUrl!;
      });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_missing');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (blurFaces && boxesToBlur.length > 0) {
        boxesToBlur.forEach((box) => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(box.x, box.y, box.width, box.height);
          ctx.clip();
          ctx.filter = 'blur(12px)';
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        });
      }

      let mimeType = image.file?.type ?? 'image/jpeg';
      if (mimeType === 'image/png') {
        const url = canvas.toDataURL('image/png');
        triggerDownload(url, replaceExtension(image.file?.name ?? 'cleaned.png', 'png'));
      } else {
        const q = removeMetadata ? clampQuality(quality) : 1;
        const url = canvas.toDataURL('image/jpeg', q);
        triggerDownload(url, replaceExtension(image.file?.name ?? 'cleaned.jpg', 'jpg'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'download_error');
    } finally {
      setDownloading(false);
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <section className="panel">
      <h2>{t('cleanup_title')}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={removeMetadata} onChange={(event) => setRemoveMetadata(event.target.checked)} />
          {t('cleanup_remove_meta')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={blurFaces}
            onChange={(event) => setBlurFaces(event.target.checked)}
            disabled={!summary || summary.boxes.length === 0}
          />
          {t('cleanup_blur_faces')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {t('cleanup_quality')}
          <input
            type="range"
            min={0.7}
            max={1}
            step={0.01}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            disabled={!hasImage}
          />
          <span>{quality.toFixed(2)}</span>
        </label>
      </div>
      {!hasImage && <p style={{ opacity: 0.7, marginTop: '1rem' }}>{t('cleanup_ready')}</p>}
      {error && <p className="alert">{error}</p>}
      <button className="button-primary" onClick={handleDownload} disabled={!hasImage || downloading} style={{ marginTop: '1rem' }}>
        {downloading ? t('loading_generic') : t('cleanup_button')}
      </button>
    </section>
  );
};

const replaceExtension = (name: string, extension: string) => {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base}.cleaned.${extension}`;
};

export default CleanupBlock;
