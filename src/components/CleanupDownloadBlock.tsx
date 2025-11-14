import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type {
  CleanupPreviewDimensions,
  ManualMask,
  PrivacyLevel,
  PrivacyPresetId
} from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  jpegQuality: number;
  renameFile: boolean;
  manualMaskMode: boolean;
  manualMasks: ManualMask[];
  antiSearchEnabled: boolean;
  antiSearchLevel: number;
  reduceColor: boolean;
  watermark: boolean;
  activePreset: PrivacyPresetId | null;
  privacyLevel: PrivacyLevel;
  previewDimensions: CleanupPreviewDimensions | null;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setBlurStrength: (value: number) => void;
  setJpegQuality: (value: number) => void;
  setRenameFile: (value: boolean) => void;
  setManualMaskMode: (value: boolean) => void;
  onManualMaskAdd: (mask: Omit<ManualMask, 'id'>) => void;
  onManualMaskRemove: (id: string) => void;
  onManualMaskClear: () => void;
  setAntiSearchEnabled: (value: boolean) => void;
  setAntiSearchLevel: (value: number) => void;
  setReduceColor: (value: boolean) => void;
  setWatermark: (value: boolean) => void;
  onApplyPreset: (preset: PrivacyPresetId) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
  personDetections: BoundingBox[];
}

const DRAW_THRESHOLD = 16;

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  removeMetadata,
  blurFaces,
  blurStrength,
  jpegQuality,
  renameFile,
  manualMaskMode,
  manualMasks,
  antiSearchEnabled,
  antiSearchLevel,
  reduceColor,
  watermark,
  activePreset,
  privacyLevel,
  previewDimensions,
  setRemoveMetadata,
  setBlurFaces,
  setBlurStrength,
  setJpegQuality,
  setRenameFile,
  setManualMaskMode,
  onManualMaskAdd,
  onManualMaskRemove,
  onManualMaskClear,
  setAntiSearchEnabled,
  setAntiSearchLevel,
  setReduceColor,
  setWatermark,
  onApplyPreset,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize,
  personDetections
}) => {
  const t = useT();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const estimatedLabel = useMemo(() => {
    if (estimatedSize != null) {
      return formatBytes(estimatedSize);
    }
    if (fileInfo) {
      return formatBytes(fileInfo.sizeBytes);
    }
    return t('emptyValue');
  }, [estimatedSize, fileInfo, t]);

  const qualityPercent = useMemo(() => Math.round(jpegQuality * 100), [jpegQuality]);

  const finalDimensions = useMemo(() => {
    if (previewDimensions) {
      return previewDimensions;
    }
    if (fileInfo) {
      return { width: fileInfo.width, height: fileInfo.height };
    }
    return null;
  }, [previewDimensions, fileInfo]);

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

  const peopleCount = useMemo(() => personDetections.filter((det) => det.label === 'person').length, [
    personDetections
  ]);

  const blurSummary = useMemo(() => {
    if (blurFaces && peopleCount > 0) {
      return t('privacyDiffBlurFaces', { count: peopleCount });
    }
    if (manualMasks.length > 0) {
      return t('privacyDiffBlurManual', { count: manualMasks.length });
    }
    return t('privacyDiffBlurNone');
  }, [blurFaces, peopleCount, manualMasks.length, t]);

  const antiSearchSummary = antiSearchEnabled
    ? t('privacyDiffAntiSearchLevel', { level: antiSearchLevel })
    : t('privacyDiffAntiSearchOff');

  const renameSummary = renameFile ? t('privacyDiffRenameOn') : t('privacyDiffRenameOff');
  const metadataSummary = removeMetadata
    ? t('privacyDiffMetadataRemoved')
    : t('privacyDiffMetadataKept');
  const colorSummary = reduceColor ? t('privacyDiffColorReduced') : t('privacyDiffColorFull');
  const watermarkSummary = watermark ? t('privacyDiffWatermarkOn') : t('privacyDiffWatermarkOff');
  const qualitySummary = t('privacyDiffQuality', { value: qualityPercent });

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

  const handleAntiSearchToggle = useCallback(
    (checked: boolean) => {
      setAntiSearchEnabled(checked);
      if (checked && antiSearchLevel <= 0) {
        setAntiSearchLevel(1);
      }
    },
    [antiSearchLevel, setAntiSearchEnabled, setAntiSearchLevel]
  );

  const handleAntiSearchSlider = useCallback(
    (value: number) => {
      if (value <= 0) {
        setAntiSearchEnabled(false);
        return;
      }
      setAntiSearchEnabled(true);
      setAntiSearchLevel(value);
    },
    [setAntiSearchEnabled, setAntiSearchLevel]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskMode || !fileInfo || !overlayRef.current) {
        return;
      }
      event.preventDefault();
      const overlay = overlayRef.current;
      overlay.setPointerCapture(event.pointerId);
      const rect = overlay.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setDraft({ startX: x, startY: y, currentX: x, currentY: y });
    },
    [manualMaskMode, fileInfo]
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || !overlayRef.current) {
      return;
    }
    event.preventDefault();
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
    setDraft((prev) => (prev ? { ...prev, currentX, currentY } : prev));
  }, [draft]);

  const finalizeMask = useCallback(() => {
    if (!draft || !fileInfo || !overlayRef.current) {
      setDraft(null);
      return;
    }
    const overlay = overlayRef.current;
    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    if (width === 0 || height === 0) {
      setDraft(null);
      return;
    }
    const startX = Math.max(0, Math.min(draft.startX, width));
    const startY = Math.max(0, Math.min(draft.startY, height));
    const endX = Math.max(0, Math.min(draft.currentX, width));
    const endY = Math.max(0, Math.min(draft.currentY, height));
    const xPx = Math.min(startX, endX);
    const yPx = Math.min(startY, endY);
    const wPx = Math.abs(endX - startX);
    const hPx = Math.abs(endY - startY);
    if (wPx < DRAW_THRESHOLD || hPx < DRAW_THRESHOLD) {
      setDraft(null);
      return;
    }
    const scaleX = fileInfo.width / width;
    const scaleY = fileInfo.height / height;
    onManualMaskAdd({
      x: xPx * scaleX,
      y: yPx * scaleY,
      width: wPx * scaleX,
      height: hPx * scaleY
    });
    setDraft(null);
  }, [draft, fileInfo, onManualMaskAdd]);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (overlayRef.current) {
        overlayRef.current.releasePointerCapture(event.pointerId);
      }
      finalizeMask();
    },
    [finalizeMask]
  );

  const handlePointerLeave = useCallback(() => {
    finalizeMask();
  }, [finalizeMask]);

  const draftStyle = useMemo(() => {
    if (!draft || !overlayRef.current) {
      return null;
    }
    const overlay = overlayRef.current;
    const x = Math.min(draft.startX, draft.currentX);
    const y = Math.min(draft.startY, draft.currentY);
    const width = Math.abs(draft.currentX - draft.startX);
    const height = Math.abs(draft.currentY - draft.startY);
    return {
      left: `${(x / overlay.clientWidth) * 100}%`,
      top: `${(y / overlay.clientHeight) * 100}%`,
      width: `${(width / overlay.clientWidth) * 100}%`,
      height: `${(height / overlay.clientHeight) * 100}%`
    } as React.CSSProperties;
  }, [draft]);

  return (
    <section className="panel cleanup-panel">
      <div className="cleanup-panel__header">
        <h2 className="section-title">{t('cleanupTitle')}</h2>
        <p className="cleanup-panel__hint">{t('cleanupHint')}</p>
      </div>

      <div className="cleanup-presets">
        <span className="cleanup-presets__label">{t('privacyPresetLabel')}</span>
        <div className="cleanup-presets__buttons">
          {(['minimal', 'balanced', 'maximal'] as PrivacyPresetId[]).map((preset) => (
            <button
              key={preset}
              type="button"
              className={`button button--ghost ${activePreset === preset ? 'is-active' : ''}`}
              onClick={() => onApplyPreset(preset)}
            >
              {t(`privacyPreset_${preset}` as const)}
            </button>
          ))}
        </div>
        <p className="cleanup-presets__description">{t('privacyPresetDescription')}</p>
      </div>

      <div className="cleanup-options">
        <label className="cleanup-checkbox">
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
        <label className="cleanup-checkbox">
          <input type="checkbox" checked={renameFile} onChange={(event) => setRenameFile(event.target.checked)} />
          <span>
            <strong>{t('renameCheckbox')}</strong>
            <small>{t('renameHint')}</small>
          </span>
        </label>
        <label className="cleanup-checkbox">
          <input type="checkbox" checked={blurFaces} onChange={(event) => setBlurFaces(event.target.checked)} />
          <span>
            <strong>{t('blurFaces')}</strong>
            <small>{t('blurFacesHint')}</small>
          </span>
        </label>
        <label className={`cleanup-checkbox ${manualMaskMode ? 'is-active' : ''}`}>
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
        <label className={`cleanup-checkbox ${antiSearchEnabled ? 'is-active' : ''}`}>
          <input
            type="checkbox"
            checked={antiSearchEnabled}
            onChange={(event) => handleAntiSearchToggle(event.target.checked)}
          />
          <span>
            <strong>{t('antiSearchLabel')}</strong>
            <small>{t('antiSearchHint')}</small>
          </span>
        </label>
      </div>

      <div className="cleanup-sliders">
        <div className="range-line">
          <label>
            {t('qualityLabel')} ({qualityPercent}%)
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
        {(blurFaces || manualMasks.length > 0) && (
          <div className="range-line">
            <label>
              {t('blurStrengthLabel')}
              <input
                type="range"
                min="8"
                max="64"
                step="1"
                value={blurStrength}
                onChange={(event) => setBlurStrength(Number(event.target.value))}
              />
            </label>
            <span className="range-line__meta">{`${Math.round(blurStrength)}px`}</span>
          </div>
        )}
        <div className="range-line">
          <label>
            {t('antiSearchSliderLabel', { level: antiSearchEnabled ? antiSearchLevel : 0 })}
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={antiSearchEnabled ? antiSearchLevel : 0}
              onChange={(event) => handleAntiSearchSlider(Number(event.target.value))}
            />
          </label>
          <span className="range-line__meta">{antiSearchSummary}</span>
        </div>
      </div>

      <div className="cleanup-preview">
        <h3 className="cleanup-preview__title">{t('cleanupPreviewTitle')}</h3>
        {manualMaskMode ? <p className="cleanup-preview__hint">{t('manualMaskDrawingHint')}</p> : null}
        {previewLoading ? (
          <p className="notice">{t('cleanupPreviewGenerating')}</p>
        ) : previewDataUrl ? (
          <div className="cleanup-preview__frame">
            <img src={previewDataUrl} alt={t('cleanupPreviewAlt')} className="cleanup-preview__image" />
            <div
              className={`cleanup-preview__overlay ${manualMaskMode ? 'is-drawing' : ''}`}
              ref={overlayRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
            >
              {manualMasks.map((mask) => (
                <div
                  key={mask.id}
                  className="cleanup-preview__mask"
                  style={{
                    left: `${(mask.x / (fileInfo?.width ?? 1)) * 100}%`,
                    top: `${(mask.y / (fileInfo?.height ?? 1)) * 100}%`,
                    width: `${(mask.width / (fileInfo?.width ?? 1)) * 100}%`,
                    height: `${(mask.height / (fileInfo?.height ?? 1)) * 100}%`
                  }}
                />
              ))}
              {draftStyle ? <div className="cleanup-preview__mask cleanup-preview__mask--draft" style={draftStyle} /> : null}
            </div>
          </div>
        ) : (
          <p className="notice">{t('cleanupPreviewUnavailable')}</p>
        )}
        {manualMasks.length > 0 ? (
          <div className="cleanup-mask-list">
            <div className="cleanup-mask-list__header">
              <span>{t('manualMaskCount', { count: manualMasks.length })}</span>
              <button type="button" className="button button--ghost" onClick={onManualMaskClear}>
                {t('manualMaskClear')}
              </button>
            </div>
            <ul>
              {manualMasks.map((mask, index) => (
                <li key={mask.id}>
                  <span>{t('manualMaskItem', { index: index + 1 })}</span>
                  <button type="button" className="button button--ghost" onClick={() => onManualMaskRemove(mask.id)}>
                    {t('manualMaskRemove')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {blurFaces && peopleCount === 0 ? <p className="notice">{t('facesMissing')}</p> : null}
      </div>

      <details className="cleanup-advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>{t('advancedToggle')}</summary>
        <label className="cleanup-checkbox">
          <input type="checkbox" checked={reduceColor} onChange={(event) => setReduceColor(event.target.checked)} />
          <span>
            <strong>{t('reduceColorLabel')}</strong>
            <small>{t('reduceColorHint')}</small>
          </span>
        </label>
        <label className="cleanup-checkbox">
          <input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
          <span>
            <strong>{t('watermarkLabel')}</strong>
            <small>{t('watermarkHint')}</small>
          </span>
        </label>
      </details>

      <div className="cleanup-summary">
        <h3 className="cleanup-summary__title">{t('privacyDiffTitle')}</h3>
        <p className={`cleanup-summary__badge cleanup-summary__badge--${privacyLevel}`}>
          {t('privacyLevelLabel', { level: privacyLevelLabel })}
        </p>
        <ul>
          <li>{metadataSummary}</li>
          <li>{resolutionSummary}</li>
          <li>{blurSummary}</li>
          <li>{antiSearchSummary}</li>
          <li>{renameSummary}</li>
          <li>{colorSummary}</li>
          <li>{watermarkSummary}</li>
          <li>{qualitySummary}</li>
        </ul>
        <p className="cleanup-summary__hint">{t('privacyDiffHint')}</p>
      </div>

      <div className="cleanup-actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            void onClean();
          }}
          disabled={!fileInfo || processing}
        >
          {processing ? t('processing') : t('downloadClean')}
        </button>
        {!fileInfo ? <p className="notice">{t('cleanUnavailable')}</p> : null}
      </div>
    </section>
  );
};
