import React, { useCallback, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { useT } from '../i18n';
import { ErrorBanner } from './ErrorBanner';

interface UploadZoneProps {
  loading: boolean;
  onFile: (file: File) => void;
  error?: string | null;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ loading, onFile, error }) => {
  const t = useT();
  const uploadInputId = `upload-input-${useId().replace(/[:]/g, '')}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      onFile(files[0]);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <section className="panel">
      <h2 className="section-title">{t('uploadTitle')}</h2>
      <p className="panel__hint">{t('uploadLead')}</p>
      <div
        className={clsx('drop-zone', { 'drag-over': dragOver })}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <label
          className="drop-zone__label"
          htmlFor={uploadInputId}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span className="sr-only">{t('uploadTitle')}</span>
          <span className="button button--primary" aria-live="polite">
            {loading ? '…' : t('uploadButton')}
          </span>
          <p className="drop-zone__hint">{t('orDrop')}</p>
          <p className="drop-zone__subhint">{t('uploadFormats')}</p>
          <p className="drop-zone__support">{t('uploadFormatsSupport')}</p>
        </label>
        <input
          id={uploadInputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/heic,image/heif,.heic,.heif"
          className="drop-zone__file sr-only"
          aria-label={t('uploadButton')}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {error ? <ErrorBanner message={error} /> : null}
    </section>
  );
};
