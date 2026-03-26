import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BasicFileInfo } from '../types/metadata';
import type { BoundingBox } from '../types/detection';
import { useT } from '../i18n';

interface PreviewViewerProps {
  fileInfo: BasicFileInfo;
  detections: BoundingBox[];
  sceneDescription: string;
  progress?: { label: string; value: number } | null;
}

export const PreviewViewer: React.FC<PreviewViewerProps> = ({
  fileInfo,
  detections,
  sceneDescription,
  progress
}) => {
  const t = useT();
  const [fullScreen, setFullScreen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const openFullscreen = useCallback(() => setFullScreen(true), []);
  const closeFullscreen = useCallback(() => {
    setFullScreen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!fullScreen) return;
    closeRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen();
      if (e.key === 'Tab') {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [fullScreen, closeFullscreen]);

  const overlays = useMemo(() => {
    return detections
      .filter((det) => det.score >= 0.5)
      .map((det, index) => {
        const style: React.CSSProperties = {
          left: `${(det.x / fileInfo.width) * 100}%`,
          top: `${(det.y / fileInfo.height) * 100}%`,
          width: `${(det.width / fileInfo.width) * 100}%`,
          height: `${(det.height / fileInfo.height) * 100}%`
        };
        return (
          <div key={`${det.label}-${index}`} className="detection-box" style={style} aria-hidden="true">
            <span className="detection-label">{det.label}</span>
          </div>
        );
      });
  }, [detections, fileInfo.height, fileInfo.width]);

  return (
    <div className="preview-panel">
      <div
        ref={triggerRef}
        className="preview-wrapper"
        role="button"
        tabIndex={0}
        aria-label={`${fileInfo.file.name} — ${t('fullscreenClose')}`}
        onClick={openFullscreen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFullscreen(); } }}
        style={{ aspectRatio: `${fileInfo.width} / ${fileInfo.height}`, cursor: 'zoom-in' }}
      >
        <img src={fileInfo.thumbnailUrl} alt={fileInfo.file.name} className="preview-image" />
        <div style={{ position: 'absolute', inset: 0 }}>{overlays}</div>
      </div>
      <p className="preview-description">{sceneDescription}</p>
      {progress ? (
        <div className="progress-row" aria-live="polite">
          <div className="progress-text">{progress.label}</div>
          <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.value * 100)}>
            <span style={{ width: `${Math.min(100, Math.max(0, progress.value * 100))}%` }} />
          </div>
        </div>
      ) : null}
      {fullScreen ? (
        <div className="fullscreen-viewer" role="dialog" aria-modal="true" aria-label={fileInfo.file.name} onClick={closeFullscreen}>
          <div className="fullscreen-inner" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="fullscreen-close" onClick={closeFullscreen} aria-label={t('fullscreenClose')}>
              {t('fullscreenClose')}
            </button>
            <div className="fullscreen-media">
              <img src={fileInfo.dataUrl} alt={fileInfo.file.name} />
              <div className="fullscreen-overlays">{overlays}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
