import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type {
  CleanupPreviewDimensions,
  ManualMask,
  PresetKey,
  PrivacyLevel,
  PrivacyScores,
  QualityMode
} from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  removeMetadata: boolean;
  blurFaces: boolean;
  blurStrength: number;
  qualityMode: QualityMode;
  renameFile: boolean;
  manualMaskMode: boolean;
  manualMasks: ManualMask[];
  antiSearchEnabled: boolean;
  antiSearchLevel: number;
  reduceColor: boolean;
  watermark: boolean;
  prnuCleanup: boolean;
  privacyLevel: PrivacyLevel;
  privacyScores: PrivacyScores;
  previewDimensions: CleanupPreviewDimensions | null;
  setRemoveMetadata: (value: boolean) => void;
  setBlurFaces: (value: boolean) => void;
  setBlurStrength: (value: number) => void;
  setQualityMode: (mode: QualityMode) => void;
  setRenameFile: (value: boolean) => void;
  setManualMaskMode: (value: boolean) => void;
  onManualMaskAdd: (mask: Omit<ManualMask, 'id'>) => void;
  onManualMaskRemove: (id: string) => void;
  setAntiSearchEnabled: (value: boolean) => void;
  setAntiSearchLevel: (value: number) => void;
  setReduceColor: (value: boolean) => void;
  setWatermark: (value: boolean) => void;
  setPrnuCleanup: (value: boolean) => void;
  preset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
  onApplyRecommendation: () => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
  personDetections: BoundingBox[];
  originalPreviewUrl: string | null;
}

const DRAW_THRESHOLD = 16;

const QUALITY_PERCENT: Record<QualityMode, number> = {
  low: Math.round(0.82 * 100),
  medium: Math.round(0.9 * 100),
  original: Math.round(0.98 * 100)
};

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  removeMetadata,
  blurFaces,
  blurStrength,
  qualityMode,
  renameFile,
  manualMaskMode,
  manualMasks,
  antiSearchEnabled,
  antiSearchLevel,
  reduceColor,
  watermark,
  prnuCleanup,
  privacyLevel,
  privacyScores,
  previewDimensions,
  setRemoveMetadata,
  setBlurFaces,
  setBlurStrength,
  setQualityMode,
  setRenameFile,
  setManualMaskMode,
  onManualMaskAdd,
  onManualMaskRemove,
  setAntiSearchEnabled,
  setAntiSearchLevel,
  setReduceColor,
  setWatermark,
  setPrnuCleanup,
  preset,
  onPresetChange,
  onApplyRecommendation,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize,
  personDetections,
  originalPreviewUrl
}) => {
  const t = useT();
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

  const peopleCount = useMemo(
    () => personDetections.filter((det) => det.label === 'person').length,
    [personDetections]
  );

  const blurSummary = useMemo(() => {
    if (manualMasks.length > 0) {
      return t('privacyDiffBlurManual', { count: manualMasks.length });
    }
    if (blurFaces && peopleCount > 0) {
      return t('privacyDiffBlurFaces', { count: peopleCount });
    }
    if (blurFaces) {
      return t('privacyDiffBlurFacesNoDetections');
    }
    return t('privacyDiffBlurNone');
  }, [blurFaces, manualMasks.length, peopleCount, t]);

  const metadataSummary = removeMetadata
    ? t('privacyDiffMetadataRemoved')
    : t('privacyDiffMetadataKept');
  const renameSummary = renameFile ? t('privacyDiffRenameOn') : t('privacyDiffRenameOff');
  const antiSearchSummary = antiSearchEnabled ? t('privacyDiffAntiSearchOn') : t('privacyDiffAntiSearchOff');
  const colorSummary = reduceColor ? t('privacyDiffColorReduced') : t('privacyDiffColorFull');
  const watermarkSummary = watermark ? t('privacyDiffWatermarkOn') : t('privacyDiffWatermarkOff');
  const prnuSummary = prnuCleanup ? t('privacyDiffPrnuOn') : t('privacyDiffPrnuOff');
  const qualitySummary = t('privacyDiffQualityMode', {
    mode: t(`qualityMode_${qualityMode}` as const),
    percent: QUALITY_PERCENT[qualityMode]
  });

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
    },
    [setAntiSearchEnabled]
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
        <label className="cleanup-presets__control">
          <span>{t('presetLabel')}</span>
          <select value={preset} onChange={(event) => onPresetChange(event.target.value as PresetKey)}>
            <option value="none">{t('presetNone')}</option>
            <option value="social">{t('presetSocial')}</option>
            <option value="work">{t('presetWork')}</option>
            <option value="proof">{t('presetProof')}</option>
            <option value="personal">{t('presetPersonal')}</option>
          </select>
        </label>
        <button type="button" className="button" onClick={onApplyRecommendation}>
          {t('privacyOneClick')}
        </button>
      </div>

      <div className="cleanup-options cleanup-options--grid">
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
        <label className={`cleanup-checkbox ${prnuCleanup ? 'is-active' : ''}`}>
          <input type="checkbox" checked={prnuCleanup} onChange={(event) => setPrnuCleanup(event.target.checked)} />
          <span>
            <strong>{t('prnuLabel')}</strong>
            <small>{t('prnuHint')}</small>
          </span>
        </label>
        <label className={`cleanup-checkbox ${reduceColor ? 'is-active' : ''}`}>
          <input type="checkbox" checked={reduceColor} onChange={(event) => setReduceColor(event.target.checked)} />
          <span>
            <strong>{t('reduceColorLabel')}</strong>
            <small>{t('reduceColorHint')}</small>
          </span>
        </label>
        <label className={`cleanup-checkbox ${watermark ? 'is-active' : ''}`}>
          <input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
          <span>
            <strong>{t('watermarkLabel')}</strong>
            <small>{t('watermarkHint')}</small>
          </span>
        </label>
      </div>

      {manualMaskMode ? <p className="cleanup-preview__hint">{t('manualMaskDrawingHint')}</p> : null}

      <div className="cleanup-control-row">
        <fieldset className="quality-selector">
          <legend>{t('qualityLabel')}</legend>
          <div className="quality-selector__options">
            {(['low', 'medium', 'original'] as QualityMode[]).map((mode) => (
              <label key={mode} className={`quality-selector__option ${qualityMode === mode ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="quality-mode"
                  value={mode}
                  checked={qualityMode === mode}
                  onChange={() => setQualityMode(mode)}
                />
                <span>{t(`qualityMode_${mode}` as const)}</span>
              </label>
            ))}
          </div>
          <span className="quality-selector__meta">
            {t('qualityPercentLabel', { percent: QUALITY_PERCENT[qualityMode] })} ·{' '}
            {t('estimatedOutputSize', { size: estimatedLabel })}
          </span>
        </fieldset>
        {(blurFaces || manualMasks.length > 0) && (
          <div className="range-line range-line--compact">
            <label htmlFor="blur-strength">{t('blurStrengthLabel')}</label>
            <input
              id="blur-strength"
              type="range"
              min="8"
              max="64"
              step="1"
              value={blurStrength}
              onChange={(event) => setBlurStrength(Number(event.target.value))}
            />
            <span className="range-line__meta">{t('blurStrengthValue', { value: Math.round(blurStrength) })}</span>
          </div>
        )}
      </div>

      {antiSearchEnabled ? (
        <p className="notice notice--muted">{t('antiSearchActiveHint')}</p>
      ) : (
        <p className="notice notice--muted">{t('antiSearchOffHint')}</p>
      )}

      {antiSearchEnabled ? (
        <div className="range-line range-line--compact">
          <label htmlFor="anti-search-level">{t('antiSearchLevelLabel')}</label>
          <input
            id="anti-search-level"
            type="range"
            min="1"
            max="3"
            step="1"
            value={antiSearchLevel}
            onChange={(event) => setAntiSearchLevel(Number(event.target.value))}
          />
          <span className="range-line__meta">{t('antiSearchLevelValue', { value: antiSearchLevel })}</span>
        </div>
      ) : null}

      <div className="privacy-score">
        <h3 className="cleanup-summary__title">{t('privacyScoreTitle', { score: privacyScores.overall })}</h3>
        <ul className="privacy-score__list">
          {privacyScores.categories.map((category) => (
            <li key={category.id} className="privacy-score__item">
              <div className="privacy-score__row">
                <span>{t(`privacyScore_${category.id}` as const)}</span>
                <span>{category.score}</span>
              </div>
              <div className="privacy-score__bar" aria-hidden="true">
                <div
                  className="privacy-score__bar-fill"
                  style={{ width: `${category.score}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="cleanup-diff-grid">
        <figure className="cleanup-diff-grid__preview">
          <figcaption>{t('previewOriginal')}</figcaption>
          {originalPreviewUrl ? (
            <img src={originalPreviewUrl} alt={t('previewOriginalAlt')} className="cleanup-preview__image" />
          ) : (
            <p className="notice">{t('cleanupPreviewUnavailable')}</p>
          )}
        </figure>
        <figure className="cleanup-diff-grid__preview">
          <figcaption>{t('previewProcessed')}</figcaption>
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
        </figure>
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
            <li>{prnuSummary}</li>
            <li>{watermarkSummary}</li>
            <li>{qualitySummary}</li>
          </ul>
          <p className="cleanup-summary__hint">{t('privacyDiffHint')}</p>
        </div>
      </div>

      {manualMasks.length > 0 ? (
        <div className="cleanup-mask-list">
          <div className="cleanup-mask-list__header">
            <span>{t('manualMaskCount', { count: manualMasks.length })}</span>
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
