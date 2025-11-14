import React, { useMemo, useState } from 'react';
import type { BasicFileInfo } from '../types/metadata';
import type { BoundingBox } from '../types/detection';
import { useT } from '../i18n';

interface PreviewViewerProps {
  fileInfo: BasicFileInfo;
  detections: BoundingBox[];
}

export const PreviewViewer: React.FC<PreviewViewerProps> = ({ fileInfo, detections }) => {
  const t = useT();
  const [fullScreen, setFullScreen] = useState(false);

  const overlays = useMemo(() => {
    const confident = detections.filter((det) => det.score >= 0.5);
    if (!confident.length) return null;
    return confident.map((det, index) => {
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
        <div key={`${det.label}-${index}`} style={style} aria-hidden="true" className="detection-box">
          <span className="detection-label">{det.label}</span>
        </div>
      );
    });
  }, [detections, fileInfo.height, fileInfo.width]);

  return (
    <div>
      <div className="preview-wrapper" role="img" aria-label={fileInfo.file.name} onClick={() => setFullScreen(true)}>
        <img src={fileInfo.thumbnailUrl} alt={fileInfo.file.name} style={{ width: '100%', height: 'auto' }} />
        <div className="detection-overlay">{overlays}</div>
      </div>
      {fullScreen ? (
        <div className="fullscreen-viewer" onClick={() => setFullScreen(false)}>
          <div className="fullscreen-inner">
            <button type="button" className="fullscreen-close" onClick={() => setFullScreen(false)}>
              {t('fullscreenClose')}
            </button>
            <img src={fileInfo.dataUrl} alt={fileInfo.file.name} />
            <div className="detection-overlay">{overlays}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
