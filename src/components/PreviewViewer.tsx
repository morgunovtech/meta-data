import React, { useMemo, useState } from 'react';
import type { BasicFileInfo } from '../types/metadata';
import type { BoundingBox } from '../types/detection';
import { useT } from '../i18n';

interface PreviewViewerProps {
  fileInfo: BasicFileInfo;
  detections: BoundingBox[];
  showBoxes: boolean;
}

export const PreviewViewer: React.FC<PreviewViewerProps> = ({ fileInfo, detections, showBoxes }) => {
  const t = useT();
  const [fullScreen, setFullScreen] = useState(false);

  const overlays = useMemo(() => {
    if (!showBoxes) return null;
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
  }, [detections, fileInfo.height, fileInfo.width, showBoxes]);

  return (
    <div>
      <div className="preview-wrapper" role="img" aria-label={fileInfo.file.name} onClick={() => setFullScreen(true)}>
        <img src={fileInfo.thumbnailUrl} alt={fileInfo.file.name} style={{ width: '100%', height: 'auto' }} />
        <div style={{ position: 'absolute', inset: 0 }}>{overlays}</div>
      </div>
      {fullScreen ? (
        <div className="fullscreen-viewer" onClick={() => setFullScreen(false)}>
          <div className="fullscreen-inner">
            <button type="button" className="fullscreen-close" onClick={() => setFullScreen(false)}>
              {t('fullscreenClose')}
            </button>
            <img src={fileInfo.dataUrl} alt={fileInfo.file.name} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
