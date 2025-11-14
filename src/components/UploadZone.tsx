import React, { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { ReturnTypeUseImageFile } from './componentTypes';

interface Props {
  image: ReturnTypeUseImageFile;
}

const UploadZone: React.FC<Props> = ({ image }) => {
  const { t } = useLanguage();
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        image.setFile(file);
      }
    },
    [image]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${isDragging ? 'var(--accent)' : 'rgba(148, 163, 184, 0.4)'}`,
        borderRadius: 24,
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        transition: 'border 0.2s ease',
        background: isDragging ? 'rgba(56, 189, 248, 0.12)' : 'transparent'
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          inputRef.current?.click();
        }
      }}
      aria-label={t('upload_title')}
    >
      <h2>{t('upload_title')}</h2>
      <p>{t('upload_subtitle')}</p>
      <div className="chip-list" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <span className="chip">JPEG</span>
        <span className="chip">PNG</span>
        <span className="chip">WebP</span>
        <span className="chip">≤ 20 MB</span>
      </div>
      <button className="button-primary" style={{ marginTop: '1.5rem' }} onClick={() => inputRef.current?.click()}>
        {t('upload_button')}
      </button>
      <p style={{ opacity: 0.7, marginTop: '0.75rem' }}>{t('upload_drag')}</p>
      <input type="file" ref={inputRef} style={{ display: 'none' }} {...image.inputProps} />
    </div>
  );
};

export default UploadZone;
