import React from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import { useT } from '../i18n';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  detections: BoundingBox[];
  removeMetadata: boolean;
  blurFaces: boolean;
  jpegQuality: number;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setJpegQuality: (value: number) => void;
  onClean: () => Promise<void>;
  processing: boolean;
}

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  detections,
  removeMetadata,
  blurFaces,
  jpegQuality,
  setRemoveMetadata,
  setBlurFaces,
  setJpegQuality,
  onClean,
  processing
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
      </div>
      <p className="notice">{t('cleanupHint')}</p>
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
