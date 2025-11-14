import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { BoundingBox } from '../types/detection';

export type PreviewData = {
  dataUrl: string;
  width: number;
  height: number;
};

type Props = {
  preview?: PreviewData;
  boxes?: BoundingBox[];
  showBoxes?: boolean;
  onToggleFullscreen: (open: boolean) => void;
  originalWidth?: number;
  originalHeight?: number;
};

export const PreviewViewer: React.FC<Props> = ({
  preview,
  boxes,
  showBoxes,
  onToggleFullscreen,
  originalWidth,
  originalHeight
}) => {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!fullscreen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreen(false);
        onToggleFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen, onToggleFullscreen]);

  useEffect(() => {
    onToggleFullscreen(fullscreen);
  }, [fullscreen, onToggleFullscreen]);

  const scaleX = originalWidth && preview ? preview.width / originalWidth : 1;
  const scaleY = originalHeight && preview ? preview.height / originalHeight : 1;

  const overlayBoxes = useMemo(() => {
    if (!showBoxes || !boxes || !preview) return [];
    return boxes.map((box) => ({
      ...box,
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY
    }));
  }, [boxes, showBoxes, preview, scaleX, scaleY]);

  if (!preview) return null;

  return (
    <div className="preview-viewer">
      <div className="preview-wrapper">
        <img
          src={preview.dataUrl}
          alt={t('thumbnailAlt')}
          width={preview.width}
          height={preview.height}
          onClick={() => setFullscreen(true)}
        />
        {overlayBoxes.map((box, index) => (
          <span
            key={`${box.className}-${index}`}
            className="preview-box"
            style={{
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${box.height}px`
            }}
          >
            {box.className}
          </span>
        ))}
      </div>
      <button type="button" onClick={() => setFullscreen(true)}>{t('fullscreen')}</button>
      {fullscreen && (
        <div className="fullscreen-backdrop" onClick={() => setFullscreen(false)} role="presentation">
          <img ref={imageRef} src={preview.dataUrl} alt={t('thumbnailAlt')} className="fullscreen-image" />
          <button type="button" className="close" onClick={() => setFullscreen(false)}>
            {t('close')}
          </button>
        </div>
      )}
    </div>
  );
};
