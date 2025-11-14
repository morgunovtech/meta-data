import React from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  detections: BoundingBox[];
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  jpegQuality: number;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setBlurStrength: (value: number) => void;
  setJpegQuality: (value: number) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
}

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  detections,
  removeMetadata,
  blurFaces,
  blurStrength,
  jpegQuality,
  setRemoveMetadata,
  setBlurFaces,
  setBlurStrength,
  setJpegQuality,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize
}) => {
  const t = useT();
  const facesCount = detections.filter((d) => d.label === 'face' && d.score >= 0.5).length;
  return (
    <section className="panel">
      <h2 className="section-title">{t('cleanupTitle')}</h2>
      <div className="controls-row">
        <label>
          <input type="checkbox" checked={removeMetadata} onChange={(event) => setRemoveMetadata(event.target.checked)} />
          {t('removeMetadata')}
        </label>
        <label>
          <input type="checkbox" checked={blurFaces} onChange={(event) => setBlurFaces(event.target.checked)} />
          {t('blurFaces')}
        </label>
        <label className="slider-label">
          <span className="slider-label__text">
            {t('blurStrengthLabel')}
            <span className="slider-value">{`${blurStrength}px`}</span>
          </span>
          <input
            type="range"
            min="8"
            max="60"
            step="1"
            value={blurStrength}
            disabled={!blurFaces}
            onChange={(event) => setBlurStrength(Number(event.target.value))}
          />
        </label>
        <label className="slider-label">
          <span className="slider-label__text">
            {t('qualityLabel')}
            <span className="slider-value">{`${Math.round(jpegQuality * 100)}%`}</span>
          </span>
          <input
            type="range"
            min="0.7"
            max="1"
            step="0.01"
            value={jpegQuality}
            onChange={(event) => setJpegQuality(Number(event.target.value))}
          />
        </label>
      </div>
      {estimatedSize != null ? (
        <p className="notice">{t('estimatedSizeLabel', { value: formatBytes(estimatedSize) })}</p>
      ) : null}
      <p className="notice">{t('cleanupHint')}</p>
      {fileInfo ? (
        <div className="cleanup-preview">
          <h3 className="cleanup-preview__title">{t('cleanupPreviewTitle')}</h3>
          {previewLoading ? (
            <p className="notice">{t('cleanupPreviewGenerating')}</p>
          ) : previewDataUrl ? (
            <div className="cleanup-preview__frame">
              <img src={previewDataUrl} alt={t('cleanupPreviewAlt')} className="cleanup-preview__image" />
            </div>
          ) : (
            <p className="notice">{t('cleanupPreviewUnavailable')}</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="button button--primary"
        onClick={onClean}
        disabled={!fileInfo || (!removeMetadata && !blurFaces) || processing}
      >
        {processing ? t('processing') : t('downloadClean')}
      </button>
      {!fileInfo ? <p className="notice">{t('cleanUnavailable')}</p> : null}
      {blurFaces && facesCount === 0 ? <p className="notice">{t('facesMissing')}</p> : null}
      {blurFaces && facesCount > 0 ? (
        <p className="notice">{t('facesDetected', { count: facesCount })}</p>
      ) : null}
    </section>
  );
};
