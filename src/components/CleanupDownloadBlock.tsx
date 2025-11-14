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
  const estimatedLabel = estimatedSize != null ? formatBytes(estimatedSize) : t('emptyValue');
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
      </div>
      <div className="range-line">
        <label>
          {t('qualityLabel')}
          <input
            type="range"
            min="0.7"
            max="1"
            step="0.01"
            value={jpegQuality}
            onChange={(event) => setJpegQuality(Number(event.target.value))}
          />
        </label>
        <span className="range-line__meta">{t('estimatedOutputSize', { size: estimatedLabel })}</span>
      </div>
      {blurFaces ? (
        <div className="range-line">
          <label>
            {t('blurStrengthLabel')}
            <input
              type="range"
              min="8"
              max="48"
              step="1"
              value={blurStrength}
              onChange={(event) => setBlurStrength(Number(event.target.value))}
            />
          </label>
          <span className="range-line__meta">{`${Math.round(blurStrength)}px`}</span>
        </div>
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
      {blurFaces && detections.filter((d) => d.label === 'person').length === 0 ? (
        <p className="notice">{t('facesMissing')}</p>
      ) : null}
    </section>
  );
};
