import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { BoundingBox } from '../types/detection';
import type { BasicFileInfo } from '../types/metadata';
import type { CleanupOptions, CleanupPresetKey, ManualMaskRegion } from '../types/cleanup';
import { useT } from '../i18n';
import { formatBytes } from '../utils/format';
import { normalizeManualMask } from '../utils/metadataCleanup';

interface CleanupDownloadBlockProps {
  fileInfo: BasicFileInfo | null;
  detections: BoundingBox[];
  options: CleanupOptions;
  summary: {
    metadataStatus: string;
    blurStatus: string;
    antiSearchStatus: string;
    renameStatus: string;
    resolutionStatus: string;
    colorStatus: string;
    watermarkStatus: string;
    level: string;
  } | null;
  onOptionChange: <K extends keyof CleanupOptions>(key: K, value: CleanupOptions[K]) => void;
  onPreset: (preset: CleanupPresetKey) => void;
  manualMasks: ManualMaskRegion[];
  setManualMasks: (masks: ManualMaskRegion[]) => void;
  onClean: () => Promise<void>;
  processing: boolean;
  previewDataUrl: string | null;
  previewLoading: boolean;
  estimatedSize: number | null;
  metadataRemovedReason: 'none' | 'explicit' | 'transform';
}

type DrawingState = {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  pointerId: number;
} | null;

const maskId = () => `mask-${Math.random().toString(36).slice(2, 10)}`;

export const CleanupDownloadBlock: React.FC<CleanupDownloadBlockProps> = ({
  fileInfo,
  detections,
  options,
  summary,
  onOptionChange,
  onPreset,
  manualMasks,
  setManualMasks,
  onClean,
  processing,
  previewDataUrl,
  previewLoading,
  estimatedSize,
  metadataRemovedReason
}) => {
  const t = useT();
  const estimatedLabel = estimatedSize != null ? formatBytes(estimatedSize) : t('emptyValue');
  const [maskMode, setMaskMode] = useState(false);
  const [drawing, setDrawing] = useState<DrawingState>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const personCount = useMemo(() => detections.filter((d) => d.label === 'person').length, [detections]);

  const toggleMaskMode = useCallback(() => {
    setMaskMode((prev) => !prev);
  }, []);

  const handleMaskPointerDown = useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (!maskMode || !overlayRef.current) {
        return;
      }
      const rect = overlayRef.current.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;
      const pointerId = event.pointerId;
      overlayRef.current.setPointerCapture(pointerId);
      setDrawing({ originX: relX, originY: relY, currentX: relX, currentY: relY, pointerId });
    },
    [maskMode]
  );

  const handleMaskPointerMove = useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (!maskMode || !overlayRef.current || !drawing) {
        return;
      }
      if (drawing.pointerId !== event.pointerId) {
        return;
      }
      const rect = overlayRef.current.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;
      setDrawing({ ...drawing, currentX: relX, currentY: relY });
    },
    [drawing, maskMode]
  );

  const handleMaskPointerUp = useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (!maskMode || !overlayRef.current || !drawing) {
        return;
      }
      if (drawing.pointerId !== event.pointerId) {
        return;
      }
      overlayRef.current.releasePointerCapture(event.pointerId);
      const { originX, originY, currentX, currentY } = drawing;
      const x = Math.min(originX, currentX);
      const y = Math.min(originY, currentY);
      const width = Math.abs(currentX - originX);
      const height = Math.abs(currentY - originY);
      if (width > 0.01 && height > 0.01) {
        const normalized = normalizeManualMask({ id: maskId(), x, y, width, height });
        setManualMasks([...manualMasks, normalized]);
      }
      setDrawing(null);
    },
    [drawing, manualMasks, maskMode, setManualMasks]
  );

  const handleMaskPointerCancel = useCallback<React.PointerEventHandler<HTMLDivElement>>(() => {
    setDrawing(null);
  }, []);

  const draftMask = useMemo(() => {
    if (!drawing) return null;
    const x = Math.min(drawing.originX, drawing.currentX);
    const y = Math.min(drawing.originY, drawing.currentY);
    const width = Math.abs(drawing.currentX - drawing.originX);
    const height = Math.abs(drawing.currentY - drawing.originY);
    return { x, y, width, height };
  }, [drawing]);

  const metadataNotice = useMemo(() => {
    if (metadataRemovedReason === 'explicit') {
      return t('metadataRemovalExplicit');
    }
    if (metadataRemovedReason === 'transform') {
      return t('metadataRemovalTransform');
    }
    return t('metadataRemovalSkipped');
  }, [metadataRemovedReason, t]);

  return (
    <section className="panel">
      <h2 className="section-title">{t('cleanupTitle')}</h2>

      <div className="cleanup-presets">
        <span className="cleanup-presets__label">{t('cleanupPresets')}</span>
        <div className="cleanup-presets__buttons">
          <button type="button" className="button button--ghost" onClick={() => onPreset('basic')}>
            {t('presetBasic')}
          </button>
          <button type="button" className="button button--ghost" onClick={() => onPreset('strong')}>
            {t('presetStrong')}
          </button>
        </div>
        <p className="note note--small">{t('presetHint')}</p>
      </div>

      <div className="cleanup-controls">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={options.removeMetadata}
            onChange={(event) => onOptionChange('removeMetadata', event.target.checked)}
          />
          <span>{t('removeMetadata')}</span>
        </label>
        <p className="note note--small">{metadataNotice}</p>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={options.renameFile}
            onChange={(event) => onOptionChange('renameFile', event.target.checked)}
          />
          <span>{t('renameFileLabel')}</span>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={options.blurFaces}
            onChange={(event) => onOptionChange('blurFaces', event.target.checked)}
          />
          <span>{t('blurFaces')}</span>
        </label>
        {options.blurFaces ? (
          <p className="note note--small">{t('blurFacesHint', { count: personCount })}</p>
        ) : null}

        <button
          type="button"
          className={`button button--ghost ${maskMode ? 'button--active' : ''}`}
          onClick={toggleMaskMode}
          disabled={!previewDataUrl}
        >
          {maskMode ? t('manualMaskActive') : t('manualMaskToggle')}
        </button>
        {manualMasks.length > 0 ? (
          <div className="cleanup-mask-toolbar">
            <span className="note note--small">{t('manualMaskCount', { count: manualMasks.length })}</span>
            <button type="button" className="button button--ghost" onClick={() => setManualMasks([])}>
              {t('manualMaskClear')}
            </button>
          </div>
        ) : (
          <p className="note note--small">{t('manualMaskHint')}</p>
        )}

        {options.blurFaces || manualMasks.length > 0 ? (
          <div className="range-line">
            <label>
              {t('blurStrengthLabel')}
              <input
                type="range"
                min="8"
                max="64"
                step="1"
                value={options.blurStrength}
                onChange={(event) => onOptionChange('blurStrength', Number(event.target.value))}
              />
            </label>
            <span className="range-line__meta">{t('blurStrengthValue', { value: Math.round(options.blurStrength) })}</span>
          </div>
        ) : null}

        <label className="checkbox">
          <input
            type="checkbox"
            checked={options.antiSearchEnabled}
            onChange={(event) => {
              const checked = event.target.checked;
              onOptionChange('antiSearchEnabled', checked);
              if (checked && options.antiSearchStrength === 0) {
                onOptionChange('antiSearchStrength', 1);
              }
            }}
          />
          <span>{t('antiSearchLabel')}</span>
        </label>
        {options.antiSearchEnabled ? (
          <div className="range-line">
            <label>
              {t('antiSearchIntensity')}
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={options.antiSearchStrength}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  onOptionChange('antiSearchStrength', value);
                  if (value === 0) {
                    onOptionChange('antiSearchEnabled', false);
                  }
                }}
              />
            </label>
            <span className="range-line__meta">{t('antiSearchLevel', { level: options.antiSearchStrength })}</span>
          </div>
        ) : null}
        {options.antiSearchEnabled ? <p className="note note--small">{t('antiSearchHint')}</p> : null}

        <div className="range-line">
          <label>
            {t('qualityLabel')}
            <input
              type="range"
              min="0.7"
              max="1"
              step="0.01"
              value={options.jpegQuality}
              onChange={(event) => onOptionChange('jpegQuality', Number(event.target.value))}
            />
          </label>
          <span className="range-line__meta">{t('estimatedOutputSize', { size: estimatedLabel })}</span>
        </div>

        <details className="cleanup-advanced">
          <summary>{t('advancedOptions')}</summary>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.reduceColors}
              onChange={(event) => onOptionChange('reduceColors', event.target.checked)}
            />
            <span>{t('reduceColorsLabel')}</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.addWatermark}
              onChange={(event) => onOptionChange('addWatermark', event.target.checked)}
            />
            <span>{t('watermarkLabel')}</span>
          </label>
        </details>
      </div>

      {fileInfo ? (
        <div className="cleanup-preview">
          <h3 className="cleanup-preview__title">{t('cleanupPreviewTitle')}</h3>
          {previewLoading ? (
            <p className="notice">{t('cleanupPreviewGenerating')}</p>
          ) : previewDataUrl ? (
            <div
              className={`cleanup-preview__frame ${maskMode ? 'cleanup-preview__frame--masking' : ''}`}
              ref={overlayRef}
              onPointerDown={handleMaskPointerDown}
              onPointerMove={handleMaskPointerMove}
              onPointerUp={handleMaskPointerUp}
              onPointerLeave={handleMaskPointerCancel}
              onPointerCancel={handleMaskPointerCancel}
            >
              <img src={previewDataUrl} alt={t('cleanupPreviewAlt')} className="cleanup-preview__image" />
              <div className="cleanup-preview__overlay">
                {manualMasks.map((mask) => (
                  <div
                    key={mask.id}
                    className="cleanup-mask"
                    style={{
                      left: `${mask.x * 100}%`,
                      top: `${mask.y * 100}%`,
                      width: `${mask.width * 100}%`,
                      height: `${mask.height * 100}%`
                    }}
                  />
                ))}
                {draftMask ? (
                  <div
                    className="cleanup-mask cleanup-mask--draft"
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
        </div>
      ) : null}

      {summary ? (
        <div className="cleanup-summary">
          <h3 className="cleanup-summary__title">{t('privacyDiffTitle')}</h3>
          <ul className="cleanup-summary__list">
            <li>{summary.metadataStatus}</li>
            <li>{summary.blurStatus}</li>
            <li>{summary.antiSearchStatus}</li>
            <li>{summary.renameStatus}</li>
            <li>{summary.resolutionStatus}</li>
            <li>{summary.colorStatus}</li>
            <li>{summary.watermarkStatus}</li>
          </ul>
          <p className="privacy-level">{t('privacyLevelLabel', { level: summary.level })}</p>
        </div>
      ) : null}

      <p className="notice">{t('cleanupHint')}</p>

      <button type="button" className="button button--primary" onClick={onClean} disabled={!fileInfo || processing}>
        {processing ? t('processing') : t('downloadClean')}
      </button>
      {!fileInfo ? <p className="notice">{t('cleanUnavailable')}</p> : null}
      {options.blurFaces && personCount === 0 ? <p className="notice">{t('facesMissing')}</p> : null}
    </section>
  );
};
