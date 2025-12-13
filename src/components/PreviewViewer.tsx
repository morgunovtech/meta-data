import React, { useMemo, useState } from 'react';
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

  const overlays = useMemo(() => {
    return detections
      .filter((det) => det.score >= 0.5)
      .map((det, index) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${(det.x / fileInfo.width) * 100}%`,
          top: `${(det.y / fileInfo.height) * 100}%`,
          width: `${(det.width / fileInfo.width) * 100}%`,
          height: `${(det.height / fileInfo.height) * 100}%`,
          border: '2px solid rgba(56,189,248,0.8)',
          borderRadius: '8px',
          boxShadow: '0 0 12px rgba(56,189,248,0.6)',
          pointerEvents: 'none'
        };
        return (
          <div key={`${det.label}-${index}`} style={style} aria-hidden="true">
            <span
              style={{
                position: 'absolute',
                top: '-1.5rem',
                left: 0,
                padding: '0.2rem 0.4rem',
                background: 'rgba(15,23,42,0.9)',
                color: '#e2e8f0',
                fontSize: '0.7rem',
                borderRadius: '6px'
              }}
            >
              {det.label}
            </span>
          </div>
        );
      });
  }, [detections, fileInfo.height, fileInfo.width]);

  return (
    <div className="preview-panel">
      <div className="preview-wrapper" role="img" aria-label={fileInfo.file.name} onClick={() => setFullScreen(true)}>
        <img src={fileInfo.thumbnailUrl} alt={fileInfo.file.name} style={{ width: '100%', height: 'auto' }} />
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
        <div className="fullscreen-viewer" onClick={() => setFullScreen(false)}>
          <div className="fullscreen-inner">
            <button type="button" className="fullscreen-close" onClick={() => setFullScreen(false)}>
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
