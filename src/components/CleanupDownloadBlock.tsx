import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type { CleanupPresetConfig, ManualMaskRegion } from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';

interface CleanupSummarySnapshot {
  metadataRemoved: boolean;
  resolutionBefore: string;
  resolutionAfter: string | null;
  facesRequested: boolean;
  facesDetected: number;
  facesBlurred: boolean;
  manualMaskEnabled: boolean;
  manualMaskCount: number;
  antiSearchLevel: number;
  renameEnabled: boolean;
  reduceColor: boolean;
  watermark: boolean;
  privacyLevel: 'low' | 'medium' | 'high';
}

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  detections: BoundingBox[];
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  jpegQuality: number;
  renameFile: boolean;
  antiSearchEnabled: boolean;
  antiSearchIntensity: number;
  manualMaskEnabled: boolean;
  manualMasks: ManualMaskRegion[];
  reduceColor: boolean;
  watermark: boolean;
  cleanupSummary: CleanupSummarySnapshot | null;
  activePreset: string | null;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setBlurStrength: (value: number) => void;
  setJpegQuality: (value: number) => void;
  setRenameFile: (value: boolean) => void;
  setAntiSearchEnabled: (value: boolean) => void;
  setAntiSearchIntensity: (value: number) => void;
  setManualMaskEnabled: (value: boolean) => void;
  onManualMasksChange: (value: ManualMaskRegion[]) => void;
  onManualMasksClear: () => void;
  setReduceColor: (value: boolean) => void;
  setWatermark: (value: boolean) => void;
  applyPreset: (preset: CleanupPresetConfig) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
}

type DraftMask = {
  originX: number;
  originY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_MASK_SPAN = 0.01;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function createMaskId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  detections,
  removeMetadata,
  blurFaces,
  blurStrength,
  jpegQuality,
  renameFile,
  antiSearchEnabled,
  antiSearchIntensity,
  manualMaskEnabled,
  manualMasks,
  reduceColor,
  watermark,
  cleanupSummary,
  activePreset,
  setRemoveMetadata,
  setBlurFaces,
  setBlurStrength,
  setJpegQuality,
  setRenameFile,
  setAntiSearchEnabled,
  setAntiSearchIntensity,
  setManualMaskEnabled,
  onManualMasksChange,
  onManualMasksClear,
  setReduceColor,
  setWatermark,
  applyPreset,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize
}) => {
  const t = useT();
  const estimatedLabel = estimatedSize != null ? formatBytes(estimatedSize) : t('emptyValue');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftMask, setDraftMask] = useState<DraftMask | null>(null);

  const presets = useMemo<CleanupPresetConfig[]>(
    () => [
      {
        id: 'quick-scrub',
        labelKey: 'presetQuickLabel',
        descriptionKey: 'presetQuickDescription',
        options: {
          removeMetadata: true,
          renameFile: true,
          blurFaces: false,
          manualMaskEnabled: false,
          antiSearch: { enabled: false, intensity: 0 },
          reduceColor: false,
          watermark: false
        }
      },
      {
        id: 'balanced-privacy',
        labelKey: 'presetBalancedLabel',
        descriptionKey: 'presetBalancedDescription',
        options: {
          removeMetadata: true,
          renameFile: true,
          blurFaces: true,
          blurStrength: 30,
          antiSearch: { enabled: true, intensity: 1 },
          reduceColor: false,
          watermark: false
        }
      },
      {
        id: 'maximum-stealth',
        labelKey: 'presetStealthLabel',
        descriptionKey: 'presetStealthDescription',
        options: {
          removeMetadata: true,
          renameFile: true,
          blurFaces: true,
          blurStrength: 36,
          antiSearch: { enabled: true, intensity: 2 },
          reduceColor: true,
          watermark: true
        }
      }
    ],
    []
  );

  const handlePresetClick = useCallback(
    (preset: CleanupPresetConfig) => {
      applyPreset(preset);
    },
    [applyPreset]
  );

  const updateDraft = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskEnabled) {
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const relX = clamp01((event.clientX - rect.left) / rect.width);
      const relY = clamp01((event.clientY - rect.top) / rect.height);
      setDraftMask((current) => {
        if (!current) {
          return {
            originX: relX,
            originY: relY,
            x: relX,
            y: relY,
            width: 0,
            height: 0
          };
        }
        const minX = clamp01(Math.min(current.originX, relX));
        const minY = clamp01(Math.min(current.originY, relY));
        const maxX = clamp01(Math.max(current.originX, relX));
        const maxY = clamp01(Math.max(current.originY, relY));
        return {
          originX: current.originX,
          originY: current.originY,
          x: minX,
          y: minY,
          width: clamp01(maxX - minX),
          height: clamp01(maxY - minY)
        };
      });
    },
    [manualMaskEnabled]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskEnabled || previewLoading) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      updateDraft(event);
    },
    [manualMaskEnabled, previewLoading, updateDraft]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualMaskEnabled || previewLoading || !event.currentTarget.hasPointerCapture(event.pointerId)) {
        return;
      }
      updateDraft(event);
    },
    [manualMaskEnabled, previewLoading, updateDraft]
  );

  const commitDraft = useCallback(() => {
    setDraftMask((current) => {
      if (!current || current.width < MIN_MASK_SPAN || current.height < MIN_MASK_SPAN) {
        return null;
      }
      const normalized: ManualMaskRegion = {
        id: createMaskId(),
        x: current.x,
        y: current.y,
        width: current.width,
        height: current.height
      };
      onManualMasksChange([...manualMasks, normalized]);
      return null;
    });
  }, [manualMasks, onManualMasksChange]);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!manualMaskEnabled || previewLoading) {
        setDraftMask(null);
        return;
      }
      commitDraft();
    },
    [commitDraft, manualMaskEnabled, previewLoading]
  );

  const maskRectangles = useMemo(() => {
    return manualMasks.map((mask) => ({
      id: mask.id,
      style: {
        left: `${mask.x * 100}%`,
        top: `${mask.y * 100}%`,
        width: `${mask.width * 100}%`,
        height: `${mask.height * 100}%`
      }
    }));
  }, [manualMasks]);

  const draftRectangleStyle = draftMask
    ? {
        left: `${draftMask.x * 100}%`,
        top: `${draftMask.y * 100}%`,
        width: `${draftMask.width * 100}%`,
        height: `${draftMask.height * 100}%`
      }
    : null;

  const manualMaskActive = manualMaskEnabled && (manualMasks.length > 0 || draftMask);

  useEffect(() => {
    if (!manualMaskEnabled) {
      setDraftMask(null);
    }
  }, [manualMaskEnabled]);

  return (
    <section className="panel">
      <h2 className="section-title">{t('cleanupTitle')}</h2>
      <div className="preset-row" role="group" aria-label={t('presetGroupLabel')}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset-button${activePreset === preset.id ? ' preset-button--active' : ''}`}
            onClick={() => handlePresetClick(preset)}
          >
            <span className="preset-button__label">{t(preset.labelKey as any)}</span>
            <span className="preset-button__description">{t(preset.descriptionKey as any)}</span>
          </button>
        ))}
      </div>
      <p className="notice notice--muted">{t('presetHint')}</p>

      <div className="controls-stack">
        <label className="control-checkbox">
          <input type="checkbox" checked={removeMetadata} onChange={(event) => setRemoveMetadata(event.target.checked)} />
          <span>
            {t('removeMetadata')}
            <span className="control-checkbox__hint">{t('removeMetadataHint')}</span>
          </span>
        </label>

        <label className="control-checkbox">
          <input type="checkbox" checked={renameFile} onChange={(event) => setRenameFile(event.target.checked)} />
          <span>
            {t('renameFileLabel')}
            <span className="control-checkbox__hint">{t('renameFileHint')}</span>
          </span>
        </label>

        <label className="control-checkbox">
          <input type="checkbox" checked={blurFaces} onChange={(event) => setBlurFaces(event.target.checked)} />
          <span>
            {t('blurFaces')}
            <span className="control-checkbox__hint">{t('blurFacesHint')}</span>
          </span>
        </label>

        <label className="control-checkbox">
          <input type="checkbox" checked={manualMaskEnabled} onChange={(event) => setManualMaskEnabled(event.target.checked)} />
          <span>
            {t('manualMaskLabel')}
            <span className="control-checkbox__hint">{t('manualMaskHint')}</span>
          </span>
        </label>

        <label className="control-checkbox">
          <input type="checkbox" checked={antiSearchEnabled} onChange={(event) => setAntiSearchEnabled(event.target.checked)} />
          <span>
            {t('antiSearchLabel')}
            <span className="control-checkbox__hint">{t('antiSearchHint')}</span>
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
      </div>

      {(blurFaces || manualMaskActive) && (
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
          <span className="range-line__meta">{t('blurStrengthValue', { value: Math.round(blurStrength) })}</span>
        </div>
      )}

      {antiSearchEnabled ? (
        <div className="range-line">
          <label>
            {t('antiSearchIntensityLabel')}
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={antiSearchIntensity}
              onChange={(event) => setAntiSearchIntensity(Number(event.target.value))}
            />
          </label>
          <span className="range-line__meta">{t('antiSearchLevelMeta', { level: antiSearchIntensity })}</span>
        </div>
      ) : null}

      <p className="notice">{t('cleanupHint')}</p>

      {fileInfo ? (
        <div className="cleanup-preview">
          <h3 className="cleanup-preview__title">{t('cleanupPreviewTitle')}</h3>
          {previewLoading ? (
            <p className="notice">{t('cleanupPreviewGenerating')}</p>
          ) : previewDataUrl ? (
            <div
              ref={containerRef}
              className={`cleanup-preview__frame${manualMaskEnabled ? ' cleanup-preview__frame--masking' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img src={previewDataUrl} alt={t('cleanupPreviewAlt')} className="cleanup-preview__image" />
              <div className="cleanup-preview__overlay" aria-hidden={!manualMaskEnabled}>
                {maskRectangles.map((mask) => (
                  <div key={mask.id} className="cleanup-preview__mask" style={mask.style} />
                ))}
                {draftRectangleStyle ? (
                  <div className="cleanup-preview__mask cleanup-preview__mask--draft" style={draftRectangleStyle} />
                ) : null}
              </div>
            </div>
          ) : (
            <p className="notice">{t('cleanupPreviewUnavailable')}</p>
          )}
          {manualMaskEnabled ? (
            <div className="mask-controls">
              <span>{t('manualMaskDrawHint')}</span>
              <button type="button" className="button button--ghost" onClick={onManualMasksClear} disabled={manualMasks.length === 0}>
                {t('manualMaskClear')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {cleanupSummary ? (
        <div className="cleanup-summary">
          <h3 className="cleanup-summary__title">{t('cleanupSummaryTitle')}</h3>
          <div className={`privacy-badge privacy-badge--${cleanupSummary.privacyLevel}`}>
            {t(`privacyLevel_${cleanupSummary.privacyLevel}` as const)}
          </div>
          <ul className="cleanup-summary__list">
            <li>
              <span className="cleanup-summary__label">{t('summaryMetadata')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.metadataRemoved ? t('summaryMetadataRemoved') : t('summaryMetadataKept')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryResolution')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.resolutionAfter
                  ? `${cleanupSummary.resolutionBefore} → ${cleanupSummary.resolutionAfter}`
                  : cleanupSummary.resolutionBefore}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryFaces')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.facesRequested
                  ? cleanupSummary.facesBlurred
                    ? t('summaryFacesBlurred', { count: cleanupSummary.facesDetected })
                    : t('summaryFacesNoDetections')
                  : t('summaryFacesUntouched')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryManualMask')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.manualMaskEnabled && cleanupSummary.manualMaskCount > 0
                  ? t('summaryManualMaskApplied', { count: cleanupSummary.manualMaskCount })
                  : t('summaryManualMaskNone')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryAntiSearch')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.antiSearchLevel > 0
                  ? t('summaryAntiSearchActive', { level: cleanupSummary.antiSearchLevel })
                  : t('summaryAntiSearchOff')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryRename')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.renameEnabled ? t('summaryRenameEnabled') : t('summaryRenameDisabled')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryColor')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.reduceColor ? t('summaryColorReduced') : t('summaryColorOriginal')}
              </span>
            </li>
            <li>
              <span className="cleanup-summary__label">{t('summaryWatermark')}</span>
              <span className="cleanup-summary__value">
                {cleanupSummary.watermark ? t('summaryWatermarkAdded') : t('summaryWatermarkNone')}
              </span>
            </li>
          </ul>
        </div>
      ) : null}

      <details className="advanced-toggle">
        <summary>{t('advancedOptions')}</summary>
        <div className="controls-stack">
          <label className="control-checkbox">
            <input type="checkbox" checked={reduceColor} onChange={(event) => setReduceColor(event.target.checked)} />
            <span>
              {t('reduceColorLabel')}
              <span className="control-checkbox__hint">{t('reduceColorHint')}</span>
            </span>
          </label>
          <label className="control-checkbox">
            <input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
            <span>
              {t('watermarkLabel')}
              <span className="control-checkbox__hint">{t('watermarkHint')}</span>
            </span>
          </label>
        </div>
      </details>

      <button
        type="button"
        className="button button--primary"
        onClick={onClean}
        disabled={!fileInfo || processing}
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
