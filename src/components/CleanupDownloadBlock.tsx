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
        {blurFaces ? (
          <label className="range-field">
            {t('blurStrengthLabel', { value: blurStrength })}
            <input
              type="range"
              min="12"
              max="48"
              step="1"
              value={blurStrength}
              onChange={(event) => setBlurStrength(Number(event.target.value))}
            />
          </label>
        ) : null}
        <label>
          {t('qualityLabel', { value: Math.round(jpegQuality * 100) })}
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
      <p className="notice">{t('cleanupHint')}</p>
      {estimatedSize != null ? (
        <p className="notice">{t('estimatedSizeLabel', { value: formatBytes(estimatedSize) })}</p>
      ) : null}
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
      {blurFaces && detections.filter((d) => d.label === 'person').length === 0 ? (
        <p className="notice">{t('facesMissing')}</p>
      ) : null}
    </section>
  );
};
