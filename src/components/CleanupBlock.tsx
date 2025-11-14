import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { blurFaces, stripMetadata } from '../utils/cleanup';
import type { DetectionSummary } from '../types/detection';
import type { ImageFileInfo } from '../hooks/useImageFile';

export const CleanupBlock: React.FC<{
  file?: File;
  info: ImageFileInfo;
  detections?: DetectionSummary;
}> = ({ file, info, detections }) => {
  const { t } = useI18n();
  const [removeMeta, setRemoveMeta] = useState(true);
  const [blur, setBlur] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [processing, setProcessing] = useState(false);

  const supportsQuality = useMemo(() => info.mimeType?.includes('jpeg') || info.mimeType?.includes('jpg'), [info.mimeType]);

  const handleCleanup = async () => {
    if (!file) return;
    setProcessing(true);
    setError(undefined);
    setStatus(undefined);
    setDownloadUrl(undefined);

    try {
      let workingBlob: Blob = file;
      if (removeMeta) {
        workingBlob = await stripMetadata(file);
      }
      if (blur) {
        if (!detections || detections.boxes.length === 0) {
          setError(t('facesMissing'));
          setProcessing(false);
          return;
        }
        const faceBoxes = detections.boxes.filter((box) => box.className === 'person' || box.className === 'face');
        if (faceBoxes.length === 0) {
          setError(t('facesMissing'));
          setProcessing(false);
          return;
        }
        workingBlob = await blurFaces(
          new File([workingBlob], info.name ?? 'image', { type: workingBlob.type || file.type }),
          faceBoxes.map((box) => ({ x: box.x, y: box.y, width: box.width, height: box.height })),
          quality
        );
      }

      const cleanedFileName = `${(info.name ?? 'image').replace(/\.[^.]+$/, '')}.cleaned.${info.mimeType?.includes('png') ? 'png' : 'jpg'}`;
      const downloadFile = new File([workingBlob], cleanedFileName, { type: workingBlob.type || file.type });
      const url = URL.createObjectURL(downloadFile);
      setDownloadUrl(url);
      setStatus(t('metadataRemoved'));
    } catch (err) {
      console.error('cleanup-failed', err);
      setError(t('cleanupError'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="cleanup-block">
      <h2>{t('cleanupTitle')}</h2>
      <label>
        <input type="checkbox" checked={removeMeta} onChange={(event) => setRemoveMeta(event.target.checked)} />
        {t('removeMetadata')}
      </label>
      <label>
        <input type="checkbox" checked={blur} onChange={(event) => setBlur(event.target.checked)} />
        {t('blurFaces')}
      </label>
      {supportsQuality && (
        <label>
          JPEG {Math.round(quality * 100)}%
          <input
            type="range"
            min={0.7}
            max={1}
            step={0.01}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />
        </label>
      )}
      <button type="button" onClick={handleCleanup} disabled={processing || (!removeMeta && !blur)} className="primary">
        {processing ? t('loading') : t('cleanDownload')}
      </button>
      {status && <p className="success-text">{status}</p>}
      {error && <p className="error-text">{error}</p>}
      {downloadUrl && (
        <a className="primary" href={downloadUrl} download>
          {t('downloadReady')}
        </a>
      )}
    </section>
  );
};
