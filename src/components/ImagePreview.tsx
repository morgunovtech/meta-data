import React, { useMemo, useState } from 'react';
import type { ImageInfo } from '@/hooks/useImageFile';
import type { DetectedObject } from '@/types/analysis';
import { useI18n } from '@/i18n/I18nContext';

export type ImagePreviewProps = {
  image?: ImageInfo;
  showBoxes?: boolean;
  detections?: DetectedObject[];
};

export const ImagePreview: React.FC<ImagePreviewProps> = ({ image, showBoxes, detections }) => {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);

  const boxes = useMemo(() => detections ?? [], [detections]);

  if (!image) {
    return null;
  }

  return (
    <div className="image-preview">
      <button type="button" className="thumbnail" onClick={() => setFullscreen(true)} aria-label={t('preview_fullscreen')}>
        <img src={image.thumbnailUrl} alt={image.name} loading="lazy" />
        {showBoxes && boxes.length > 0 && (
          <div className="boxes" aria-hidden="true">
            {boxes.map((box) => (
              <span
                key={box.id}
                className="box"
                style={{
                  left: `${(box.box.left / image.width) * 100}%`,
                  top: `${(box.box.top / image.height) * 100}%`,
                  width: `${(box.box.width / image.width) * 100}%`,
                  height: `${(box.box.height / image.height) * 100}%`
                }}
              >
                <span>{box.label}</span>
              </span>
            ))}
          </div>
        )}
      </button>
      {fullscreen && (
        <div className="fullscreen" role="dialog" aria-modal="true" onClick={() => setFullscreen(false)}>
          <button className="close" type="button" onClick={() => setFullscreen(false)}>
            {t('close')}
          </button>
          <img src={image.objectUrl} alt={image.name} />
        </div>
      )}
    </div>
  );
};
