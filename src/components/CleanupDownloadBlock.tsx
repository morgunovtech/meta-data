import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type {
  CleanupPreviewDimensions,
  JpegQualitySetting,
  ManualMask,
  PrivacyLevel
} from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  jpegQualitySetting: JpegQualitySetting;
  jpegQualityValue: number;
  renameFile: boolean;
  manualMaskMode: boolean;
  manualMasks: ManualMask[];
  antiSearchEnabled: boolean;
  reduceColor: boolean;
  collapsePalette: boolean;
  prnuRemoval: boolean;
  watermark: boolean;
  privacyLevel: PrivacyLevel;
  previewDimensions: CleanupPreviewDimensions | null;
  originalPreviewUrl: string | null;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setBlurStrength: (value: number) => void;
  setJpegQualitySetting: (value: JpegQualitySetting) => void;
  setRenameFile: (value: boolean) => void;
  setManualMaskMode: (value: boolean) => void;
  onManualMaskAdd: (mask: Omit<ManualMask, 'id'>) => void;
  onManualMaskRemove: (id: string) => void;
  setAntiSearchEnabled: (value: boolean) => void;
  setReduceColor: (value: boolean) => void;
  setCollapsePalette: (value: boolean) => void;
  setPrnuRemoval: (value: boolean) => void;
  setWatermark: (value: boolean) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
  personDetections: BoundingBox[];
}

const DRAW_THRESHOLD = 16;
const QUALITY_STEPS: JpegQualitySetting[] = ['low', 'medium', 'original'];

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  removeMetadata,
  blurFaces,
  blurStrength,
  jpegQualitySetting,
  jpegQualityValue,
  renameFile,
  manualMaskMode,
  manualMasks,
  antiSearchEnabled,
  reduceColor,
  collapsePalette,
  prnuRemoval,
  watermark,
  privacyLevel,
  previewDimensions,
  originalPreviewUrl,
  setRemoveMetadata,
  setBlurFaces,
  setBlurStrength,
  setJpegQualitySetting,
  setRenameFile,
  setManualMaskMode,
  onManualMaskAdd,
  onManualMaskRemove,
  setAntiSearchEnabled,
  setReduceColor,
  setCollapsePalette,
  setPrnuRemoval,
  setWatermark,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize,
  personDetections
}) => {
  const t = useT();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const finalDimensions = useMemo(() => {
    if (previewDimensions) return previewDimensions;
    if (fileInfo) {
      return { width: fileInfo.width, height: fileInfo.height };
    }
    return null;
  }, [previewDimensions, fileInfo]);

  const qualityIndex = useMemo(() => {
    const idx = QUALITY_STEPS.indexOf(jpegQualitySetting);
    return idx >= 0 ? idx : 1;
  }, [jpegQualitySetting]);

  const estimatedLabel = useMemo(() => {
    if (estimatedSize != null) {
      return formatBytes(estimatedSize);
    }
    if (fileInfo) {
      return formatBytes(fileInfo.sizeBytes);
    }
    return t('emptyValue');
  }, [estimatedSize, fileInfo, t]);

  const qualityPercent = useMemo(() => Math.round(jpegQualityValue * 100), [jpegQualityValue]);
  const manualMaskCount = manualMasks.length;
  const peopleCount = personDetections.length;

  const privacyLevelLabel = useMemo(() => {
    switch (privacyLevel) {
      case 'high':
        return t('privacyLevelHigh');
      case 'medium':
        return t('privacyLevelMedium');
      default:
        return t('privacyLevelLow');
    }
  }, [privacyLevel, t]);

  const resolutionSummary = useMemo(() => {
    if (!fileInfo || !finalDimensions) {
      return t('emptyValue');
    }
    const before = `${fileInfo.width}×${fileInfo.height}`;
    const after = `${finalDimensions.width}×${finalDimensions.height}`;
    if (fileInfo.width === finalDimensions.width && fileInfo.height === finalDimensions.height) {
      return t('privacyDiffResolutionSame', { value: before });
    }
    return t('privacyDiffResolutionChanged', { before, after });
  }, [fileInfo, finalDimensions, t]);

  const summaryItems = useMemo(() => {
    const items: string[] = [];
    items.push(removeMetadata ? t('privacyDiffMetadataRemoved') : t('privacyDiffMetadataKept'));
    items.push(renameFile ? t('privacyDiffRenameOn') : t('privacyDiffRenameOff'));
    if (blurFaces && peopleCount > 0) {
      items.push(t('privacyDiffBlurFaces', { count: peopleCount }));
    } else if (manualMaskCount > 0) {
      items.push(t('privacyDiffBlurManual', { count: manualMaskCount }));
    } else {
      items.push(t('privacyDiffBlurNone'));
    }
    items.push(antiSearchEnabled ? t('privacyDiffAntiSearchOn') : t('privacyDiffAntiSearchOff'));
    items.push(prnuRemoval ? t('privacyDiffPrnuOn') : t('privacyDiffPrnuOff'));
    items.push(reduceColor ? t('privacyDiffColorReduced') : t('privacyDiffColorFull'));
    items.push(collapsePalette ? t('privacyDiffPaletteOn') : t('privacyDiffPaletteOff'));
    items.push(watermark ? t('privacyDiffWatermarkOn') : t('privacyDiffWatermarkOff'));
    items.push(t('privacyDiffQualitySetting', { label: t(`cleanupQuality_${jpegQualitySetting}` as const), percent: qualityPercent }));
    items.push(resolutionSummary);
    return items;
  }, [
    antiSearchEnabled,
    collapsePalette,
    jpegQualitySetting,
    manualMaskCount,
    peopleCount,
    prnuRemoval,
    qualityPercent,
    reduceColor,
    removeMetadata,
    renameFile,
    resolutionSummary,
    t,
    watermark
  ]);

  const handleQualityChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      const next = QUALITY_STEPS[value] ?? 'medium';
      setJpegQualitySetting(next);
    },
    [setJpegQualitySetting]
  );

  const convertPoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!overlayRef.current || !finalDimensions) {
        return null;
      }
      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }
      const x = ((event.clientX - rect.left) / rect.width) * finalDimensions.width;
      const y = ((event.clientY - rect.top) / rect.height) * finalDimensions.height;
      return {
        x: Math.max(0, Math.min(finalDimensions.width, x)),
        y: Math.max(0, Math.min(finalDimensions.height, y))
      };
    },
    [finalDimensions]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskMode) {
        return;
      }
      const start = convertPoint(event);
      if (!start || !overlayRef.current) {
        return;
      }
      event.preventDefault();
      const overlay = overlayRef.current;
      overlay.setPointerCapture(event.pointerId);
      setDraft({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });
    },
    [convertPoint, manualMaskMode]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskMode || !draft) {
        return;
      }
      const current = convertPoint(event);
      if (!current) {
        return;
      }
      setDraft((prev) => (prev ? { ...prev, currentX: current.x, currentY: current.y } : prev));
    },
    [convertPoint, draft, manualMaskMode]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskMode || !draft || !overlayRef.current) {
        return;
      }
      const overlay = overlayRef.current;
      overlay.releasePointerCapture(event.pointerId);
      const endPoint = convertPoint(event) ?? { x: draft.currentX, y: draft.currentY };
      const x = Math.min(draft.startX, endPoint.x);
      const y = Math.min(draft.startY, endPoint.y);
      const width = Math.abs(endPoint.x - draft.startX);
      const height = Math.abs(endPoint.y - draft.startY);
      setDraft(null);
      if (width < DRAW_THRESHOLD || height < DRAW_THRESHOLD) {
        return;
      }
      onManualMaskAdd({ x, y, width, height });
    },
    [convertPoint, draft, manualMaskMode, onManualMaskAdd]
  );

  const relativeMasks = useMemo(() => {
    if (!finalDimensions || finalDimensions.width === 0 || finalDimensions.height === 0) {
      return [] as Array<{ id: string; style: React.CSSProperties }>;
    }
    return manualMasks.map((mask) => {
      const style: React.CSSProperties = {
        left: `${(mask.x / finalDimensions.width) * 100}%`,
        top: `${(mask.y / finalDimensions.height) * 100}%`,
        width: `${(mask.width / finalDimensions.width) * 100}%`,
        height: `${(mask.height / finalDimensions.height) * 100}%`
      };
      return { id: mask.id, style };
    });
  }, [finalDimensions, manualMasks]);

  const draftStyle = useMemo(() => {
    if (!draft || !finalDimensions) return null;
    const width = Math.abs(draft.currentX - draft.startX);
    const height = Math.abs(draft.currentY - draft.startY);
    if (width < 2 || height < 2) {
      return null;
    }
    const x = Math.min(draft.startX, draft.currentX);
    const y = Math.min(draft.startY, draft.currentY);
    return {
      left: `${(x / finalDimensions.width) * 100}%`,
      top: `${(y / finalDimensions.height) * 100}%`,
      width: `${(width / finalDimensions.width) * 100}%`,
      height: `${(height / finalDimensions.height) * 100}%`
    } as React.CSSProperties;
  }, [draft, finalDimensions]);

  const qualityOptions = useMemo(
    () =>
      QUALITY_STEPS.map((step) => ({
        value: step,
        label: t(`cleanupQuality_${step}` as const)
      })),
    [t]
  );

  const canDownload = !!fileInfo && !processing;

  return (
    <section className="panel panel--cleanup">
      <header className="cleanup-header">
        <div>
          <h2 className="section-title">{t('cleanupTitle')}</h2>
          <p className="cleanup-hint">{t('cleanupHint')}</p>
        </div>
        <span className={`privacy-badge privacy-badge--${privacyLevel}`}>{privacyLevelLabel}</span>
      </header>

      <div className="cleanup-layout">
        <div className="cleanup-options">
          <div className="cleanup-toggle">
            <label className="toggle">
              <input
                type="checkbox"
                checked={removeMetadata}
                onChange={(event) => setRemoveMetadata(event.target.checked)}
              />
              <span>
                <strong>{t('removeMetadata')}</strong>
                <small>{t('removeMetadataHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input type="checkbox" checked={renameFile} onChange={(event) => setRenameFile(event.target.checked)} />
              <span>
                <strong>{t('renameCheckbox')}</strong>
                <small>{t('renameHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input type="checkbox" checked={blurFaces} onChange={(event) => setBlurFaces(event.target.checked)} />
              <span>
                <strong>{t('blurFaces')}</strong>
                <small>{t('blurFacesHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input
                type="checkbox"
                checked={manualMaskMode}
                onChange={(event) => setManualMaskMode(event.target.checked)}
              />
              <span>
                <strong>{t('manualMaskToggle')}</strong>
                <small>{t('manualMaskHint')}</small>
              </span>
            </label>
            {manualMaskMode ? <p className="mask-instruction">{t('manualMaskDrawingHint')}</p> : null}
            <div className="mask-actions">
              <span className="mask-count">{t('manualMaskCount', { count: manualMaskCount })}</span>
            </div>
            {manualMasks.length > 0 ? (
              <ul className="mask-list">
                {manualMasks.map((mask, index) => (
                  <li key={mask.id}>
                    <span>{t('manualMaskItem', { index: index + 1 })}</span>
                    <button type="button" onClick={() => onManualMaskRemove(mask.id)}>
                      {t('manualMaskRemove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input
                type="checkbox"
                checked={antiSearchEnabled}
                onChange={(event) => setAntiSearchEnabled(event.target.checked)}
              />
              <span>
                <strong>{t('antiSearchLabel')}</strong>
                <small>{t('antiSearchHintEnhanced')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input type="checkbox" checked={prnuRemoval} onChange={(event) => setPrnuRemoval(event.target.checked)} />
              <span>
                <strong>{t('prnuLabel')}</strong>
                <small>{t('prnuHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input type="checkbox" checked={reduceColor} onChange={(event) => setReduceColor(event.target.checked)} />
              <span>
                <strong>{t('reduceColorLabel')}</strong>
                <small>{t('reduceColorHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input
                type="checkbox"
                checked={collapsePalette}
                onChange={(event) => setCollapsePalette(event.target.checked)}
              />
              <span>
                <strong>{t('paletteCollapseLabel')}</strong>
                <small>{t('paletteCollapseHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-toggle">
            <label className="toggle">
              <input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
              <span>
                <strong>{t('watermarkLabel')}</strong>
                <small>{t('watermarkHint')}</small>
              </span>
            </label>
          </div>

          <div className="cleanup-sliders">
            <div className="slider-block">
              <label className="slider-label" htmlFor="quality-slider">
                {t('qualitySliderLabel')} <span>{t(`cleanupQuality_${jpegQualitySetting}` as const)}</span>
              </label>
              <input
                id="quality-slider"
                type="range"
                min={0}
                max={QUALITY_STEPS.length - 1}
                step={1}
                value={qualityIndex}
                onChange={handleQualityChange}
              />
              <div className="slider-options">
                {qualityOptions.map((option, index) => (
                  <span key={option.value} className={index === qualityIndex ? 'is-active' : ''}>
                    {option.label}
                  </span>
                ))}
              </div>
              <p className="slider-meta">{t('estimatedSizeLabel', { value: estimatedLabel })}</p>
            </div>

            <div className="slider-block slider-block--compact">
              <label className="slider-label" htmlFor="blur-slider">
                {t('blurStrengthLabel')} <span>{Math.round(blurStrength)}</span>
              </label>
              <input
                id="blur-slider"
                type="range"
                min={12}
                max={48}
                step={2}
                value={blurStrength}
                onChange={(event) => setBlurStrength(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="cleanup-actions">
            <button type="button" className="button" onClick={onClean} disabled={!canDownload}>
              {processing ? t('processing') : t('downloadClean')}
            </button>
            {!canDownload ? <span className="cleanup-disabled">{t('cleanUnavailable')}</span> : null}
          </div>
        </div>

        <div className="cleanup-diff">
          <h3>{t('privacyDiffTitle')}</h3>
          <p className="cleanup-diff__hint">{t('privacyDiffHint')}</p>
          <div className="cleanup-preview-grid">
            <figure className="cleanup-preview">
              <figcaption>{t('previewOriginal')}</figcaption>
              {originalPreviewUrl ? (
                <img src={originalPreviewUrl} alt={fileInfo?.file.name ?? 'original'} />
              ) : (
                <div className="preview-placeholder" />
              )}
            </figure>
            <figure className={`cleanup-preview ${manualMaskMode ? 'is-masking' : ''}`}>
              <figcaption>{t('previewCleaned')}</figcaption>
              <div
                ref={overlayRef}
                className="cleanup-preview__canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => setDraft(null)}
              >
                {previewLoading ? (
                  <div className="preview-loading">{t('previewLoading')}</div>
                ) : previewDataUrl ? (
                  <>
                    <img src={previewDataUrl} alt={fileInfo?.file.name ?? 'processed'} />
                    <div className="mask-layer">
                      {relativeMasks.map((mask) => (
                        <div key={mask.id} style={mask.style} className="mask-layer__item" />
                      ))}
                      {draftStyle ? <div className="mask-layer__draft" style={draftStyle} /> : null}
                    </div>
                  </>
                ) : (
                  <div className="preview-placeholder" />
                )}
              </div>
            </figure>
            <ul className="cleanup-summary">
              {summaryItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
