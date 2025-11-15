import React, { useMemo, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type { ManualMaskRegion } from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes, formatDimensions } from '../utils/format';
import { createRandomId } from '../utils/random';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  metadataFieldCount: number;
  detections: BoundingBox[];
  removeMetadata: boolean;
  setRemoveMetadata: (value: boolean) => void;
  renameFile: boolean;
  onRenameChange: (value: boolean) => void;
  renamePreviewName: string | null;
  targetExtension: string | null;
  blurFaces: boolean;
  setBlurFaces: (value: boolean) => void;
  blurStrength: number;
  setBlurStrength: (value: number) => void;
  manualMasks: ManualMaskRegion[];
  onAddManualMask: (mask: ManualMaskRegion) => void;
  onRemoveManualMask: (id: string) => void;
  onClearManualMasks: () => void;
  antiSearchEnabled: boolean;
  antiSearchStrength: number;
  onAntiSearchChange: (value: boolean) => void;
  onAntiSearchStrengthChange: (value: number) => void;
  grayscale: boolean;
  setGrayscale: (value: boolean) => void;
  watermark: boolean;
  setWatermark: (value: boolean) => void;
  jpegQuality: number;
  setJpegQuality: (value: number) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
  estimatedResolution: { width: number; height: number } | null;
  hasAnyChange: boolean;
  manualMaskCount: number;
  applyPreset: (preset: 'quick' | 'balanced' | 'paranoid') => void;
  originalFileName: string;
  originalSize: number | null;
}

interface DraftMask {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_MASK_SIZE = 0.015;

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  metadataFieldCount,
  detections,
  removeMetadata,
  setRemoveMetadata,
  renameFile,
  onRenameChange,
  renamePreviewName,
  targetExtension,
  blurFaces,
  setBlurFaces,
  blurStrength,
  setBlurStrength,
  manualMasks,
  onAddManualMask,
  onRemoveManualMask,
  onClearManualMasks,
  antiSearchEnabled,
  antiSearchStrength,
  onAntiSearchChange,
  onAntiSearchStrengthChange,
  grayscale,
  setGrayscale,
  watermark,
  setWatermark,
  jpegQuality,
  setJpegQuality,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize,
  estimatedResolution,
  hasAnyChange,
  manualMaskCount,
  applyPreset,
  originalFileName,
  originalSize
}) => {
  const t = useT();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualMaskMode, setManualMaskMode] = useState(false);
  const [draftMask, setDraftMask] = useState<DraftMask | null>(null);
  const [maskOrigin, setMaskOrigin] = useState<{ x: number; y: number } | null>(null);

  const estimatedLabel = useMemo(
    () => (estimatedSize != null ? formatBytes(estimatedSize) : t('emptyValue')),
    [estimatedSize, t]
  );
  const originalSizeLabel = useMemo(
    () => (originalSize != null ? formatBytes(originalSize) : t('emptyValue')),
    [originalSize, t]
  );
  const resolutionBefore = useMemo(() => {
    if (!fileInfo) return t('emptyValue');
    return formatDimensions(fileInfo.width, fileInfo.height);
  }, [fileInfo, t]);
  const resolutionAfter = useMemo(() => {
    if (!estimatedResolution) return resolutionBefore;
    return formatDimensions(estimatedResolution.width, estimatedResolution.height);
  }, [estimatedResolution, resolutionBefore]);

  const personDetections = useMemo(
    () => detections.filter((det) => det.label === 'person'),
    [detections]
  );

  const blurActive = blurFaces || manualMaskCount > 0;
  const metadataStatus = useMemo(() => {
    if (removeMetadata) {
      return t('cleanupDiffMetadataRemoved', { count: metadataFieldCount });
    }
    if (metadataFieldCount > 0) {
      return t('cleanupDiffMetadataKept', { count: metadataFieldCount });
    }
    return t('cleanupDiffMetadataNone');
  }, [removeMetadata, metadataFieldCount, t]);

  const faceDetails = useMemo(() => {
    if (!blurActive) return t('cleanupDiffFacesNone');
    const parts: string[] = [];
    if (blurFaces) {
      parts.push(t('cleanupDiffFacesAuto'));
    }
    if (manualMaskCount > 0) {
      parts.push(t('cleanupDiffFacesManual', { count: manualMaskCount }));
    }
    return t('cleanupDiffFacesBlurred', { details: parts.join(', ') });
  }, [blurActive, blurFaces, manualMaskCount, t]);

  const antiSearchStatus = useMemo(
    () =>
      antiSearchEnabled
        ? t('cleanupDiffAntiSearchOn', { level: antiSearchStrength })
        : t('cleanupDiffAntiSearchOff'),
    [antiSearchEnabled, antiSearchStrength, t]
  );

  const renameStatus = useMemo(() => {
    if (!fileInfo) {
      return t('cleanupDiffRenameOff', { name: originalFileName || t('emptyValue') });
    }
    if (renameFile) {
      return t('cleanupDiffRenameOn', {
        name: renamePreviewName ?? `photo-${targetExtension ?? 'jpg'}`
      });
    }
    return t('cleanupDiffRenameOff', { name: originalFileName });
  }, [fileInfo, renameFile, renamePreviewName, targetExtension, originalFileName, t]);

  const colorStatus = grayscale ? t('cleanupDiffColorsReduced') : t('cleanupDiffColorsOriginal');
  const watermarkStatus = watermark ? t('cleanupDiffWatermarkOn') : t('cleanupDiffWatermarkOff');

  const privacyScore = (removeMetadata ? 2 : 0) + (blurActive ? 2 : 0) + (antiSearchEnabled ? antiSearchStrength : 0) + (renameFile ? 1 : 0) + (grayscale ? 1 : 0) + (watermark ? 0.5 : 0);
  const privacyLevelKey = privacyScore >= 5 ? 'cleanupPrivacyLevelHigh' : privacyScore >= 3 ? 'cleanupPrivacyLevelMedium' : 'cleanupPrivacyLevelLow';
  const privacyLevelLabel = t(privacyLevelKey);

  const summaryItems = useMemo(
    () => [
      { label: t('cleanupDiffMetadataLabel'), value: metadataStatus },
      {
        label: t('cleanupDiffResolutionLabel'),
        value: t('cleanupDiffResolutionValue', { before: resolutionBefore, after: resolutionAfter })
      },
      { label: t('cleanupDiffFacesLabel'), value: faceDetails },
      { label: t('cleanupDiffAntiSearchLabel'), value: antiSearchStatus },
      { label: t('cleanupDiffRenameLabel'), value: renameStatus },
      { label: t('cleanupDiffColorsLabel'), value: colorStatus },
      { label: t('cleanupDiffWatermarkLabel'), value: watermarkStatus }
    ],
    [
      t,
      metadataStatus,
      resolutionBefore,
      resolutionAfter,
      faceDetails,
      antiSearchStatus,
      renameStatus,
      colorStatus,
      watermarkStatus
    ]
  );

  const handleMaskPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualMaskMode) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const originX = clamp((event.clientX - rect.left) / rect.width);
    const originY = clamp((event.clientY - rect.top) / rect.height);
    setMaskOrigin({ x: originX, y: originY });
    setDraftMask({ x: originX, y: originY, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMaskPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualMaskMode || !maskOrigin) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const currentX = clamp((event.clientX - rect.left) / rect.width);
    const currentY = clamp((event.clientY - rect.top) / rect.height);
    const x = Math.min(maskOrigin.x, currentX);
    const y = Math.min(maskOrigin.y, currentY);
    const width = Math.abs(currentX - maskOrigin.x);
    const height = Math.abs(currentY - maskOrigin.y);
    setDraftMask({ x, y, width, height });
  };

  const commitMask = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualMaskMode || !maskOrigin) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const candidate = draftMask;
    setMaskOrigin(null);
    setDraftMask(null);
    if (!candidate || candidate.width < MIN_MASK_SIZE || candidate.height < MIN_MASK_SIZE) {
      return;
    }
    onAddManualMask({ id: createRandomId(8), ...candidate });
  };

  const cancelMask = () => {
    setMaskOrigin(null);
    setDraftMask(null);
  };

  const disableMaskControls = !previewDataUrl;

  return (
    <section className="panel cleanup-panel">
      <h2 className="section-title">{t('cleanupTitle')}</h2>
      <div className="cleanup-presets">
        <button type="button" className="button button--ghost" onClick={() => applyPreset('quick')}>
          {t('cleanupPresetQuick')}
        </button>
        <button type="button" className="button button--ghost" onClick={() => applyPreset('balanced')}>
          {t('cleanupPresetBalanced')}
        </button>
        <button type="button" className="button button--ghost" onClick={() => applyPreset('paranoid')}>
          {t('cleanupPresetParanoid')}
        </button>
      </div>
      <p className="notice cleanup-presets__hint">{t('cleanupPresetHint')}</p>
      <div className="cleanup-controls">
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={renameFile}
            onChange={(event) => onRenameChange(event.target.checked)}
          />
          <span>
            <span>{t('renameFileLabel')}</span>
            <span className="control-hint">{t('renameFileHint')}</span>
            {renameFile && renamePreviewName ? (
              <span className="control-meta">{t('renameFilePreview', { name: renamePreviewName })}</span>
            ) : null}
          </span>
        </label>
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={removeMetadata}
            onChange={(event) => setRemoveMetadata(event.target.checked)}
          />
          <span>
            <span>{t('removeMetadataEnhanced')}</span>
            <span className="control-hint">{t('removeMetadataHint')}</span>
          </span>
        </label>
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={blurFaces}
            onChange={(event) => setBlurFaces(event.target.checked)}
          />
          <span>
            <span>{t('blurFaces')}</span>
            <span className="control-hint">{t('blurFacesHint')}</span>
          </span>
        </label>
        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={antiSearchEnabled}
            onChange={(event) => onAntiSearchChange(event.target.checked)}
          />
          <span>
            <span>{t('antiSearchLabel')}</span>
            <span className="control-hint">{t('antiSearchHint')}</span>
          </span>
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
        <span className="range-line__meta range-line__meta--secondary">
          {t('originalSizeLabel', { size: originalSizeLabel })}
        </span>
      </div>
      {blurActive ? (
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
      {antiSearchEnabled ? (
        <div className="range-line">
          <label>
            {t('antiSearchIntensityLabel')}
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={antiSearchStrength}
              onChange={(event) => onAntiSearchStrengthChange(Number(event.target.value))}
            />
          </label>
          <span className="range-line__meta">{t('antiSearchLevel', { level: antiSearchStrength })}</span>
        </div>
      ) : null}
      <div className="cleanup-preview">
        <h3 className="cleanup-preview__title">{t('cleanupPreviewTitle')}</h3>
        <p className="notice">{t('cleanupHint')}</p>
        {previewLoading ? (
          <p className="notice">{t('cleanupPreviewGenerating')}</p>
        ) : previewDataUrl ? (
          <div className={`cleanup-preview__frame ${manualMaskMode ? 'cleanup-preview__frame--masking' : ''}`}>
            <img src={previewDataUrl} alt={t('cleanupPreviewAlt')} className="cleanup-preview__image" />
            <div
              className={`cleanup-mask-overlay ${manualMaskMode ? 'cleanup-mask-overlay--active' : ''}`}
              onPointerDown={handleMaskPointerDown}
              onPointerMove={handleMaskPointerMove}
              onPointerUp={commitMask}
              onPointerLeave={cancelMask}
            >
              {manualMasks.map((mask) => (
                <span
                  key={mask.id}
                  className="cleanup-mask-overlay__box"
                  style={{
                    left: `${mask.x * 100}%`,
                    top: `${mask.y * 100}%`,
                    width: `${mask.width * 100}%`,
                    height: `${mask.height * 100}%`
                  }}
                />
              ))}
              {draftMask ? (
                <span
                  className="cleanup-mask-overlay__box cleanup-mask-overlay__box--draft"
                  style={{
                    left: `${draftMask.x * 100}%`,
                    top: `${draftMask.y * 100}%`,
                    width: `${draftMask.width * 100}%`,
                    height: `${draftMask.height * 100}%`
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <p className="notice">{t('cleanupPreviewUnavailable')}</p>
        )}
        <div className="cleanup-mask-controls">
          <button
            type="button"
            className={`button button--ghost ${manualMaskMode ? 'button--active' : ''}`}
            onClick={() => setManualMaskMode((prev) => !prev)}
            disabled={disableMaskControls}
          >
            {t('manualMaskToggle')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClearManualMasks}
            disabled={manualMaskCount === 0}
          >
            {t('manualMaskClear')}
          </button>
        </div>
        <p className="notice">{t('manualMaskHint')}</p>
        {manualMaskCount > 0 ? (
          <ul className="cleanup-mask-list">
            {manualMasks.map((mask, index) => (
              <li key={mask.id}>
                <span>{t('manualMaskItem', { index: index + 1 })}</span>
                <button type="button" className="button button--chip" onClick={() => onRemoveManualMask(mask.id)}>
                  {t('manualMaskRemove')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cleanup-mask-empty">{t('manualMaskEmpty')}</p>
        )}
      </div>
      <button
        type="button"
        className="button button--ghost cleanup-advanced-toggle"
        onClick={() => setAdvancedOpen((prev) => !prev)}
      >
        {advancedOpen ? t('advancedCollapse') : t('advancedExpand')}
      </button>
      {advancedOpen ? (
        <div className="cleanup-advanced">
          <label className="control-checkbox">
            <input
              type="checkbox"
              checked={grayscale}
              onChange={(event) => setGrayscale(event.target.checked)}
            />
            <span>
              <span>{t('grayscaleLabel')}</span>
              <span className="control-hint">{t('grayscaleHint')}</span>
            </span>
          </label>
          <label className="control-checkbox">
            <input
              type="checkbox"
              checked={watermark}
              onChange={(event) => setWatermark(event.target.checked)}
            />
            <span>
              <span>{t('watermarkLabel')}</span>
              <span className="control-hint">{t('watermarkHint')}</span>
            </span>
          </label>
        </div>
      ) : null}
      <div className="cleanup-summary">
        <div className="cleanup-summary__header">
          <h3>{t('privacyDiffTitle')}</h3>
          <span className="cleanup-summary__badge">{t('cleanupPrivacyLevelLabel', { level: privacyLevelLabel })}</span>
        </div>
        <dl className="cleanup-summary__list">
          {summaryItems.map((item) => (
            <div key={item.label} className="cleanup-summary__row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <button
        type="button"
        className="button button--primary"
        onClick={onClean}
        disabled={!fileInfo || !hasAnyChange || processing}
      >
        {processing ? t('processing') : t('downloadClean')}
      </button>
      {!fileInfo ? <p className="notice">{t('cleanUnavailable')}</p> : null}
      {blurFaces && personDetections.length === 0 ? (
        <p className="notice">{t('facesMissing')}</p>
      ) : null}
    </section>
  );
};
