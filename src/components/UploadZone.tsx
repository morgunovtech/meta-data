import React, { useCallback, useRef, useState } from 'react';
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
        role="button"
        tabIndex={0}
        aria-busy={loading}
        aria-label={t('uploadTitle')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
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
        <label className="drop-zone__label" htmlFor="upload-input">
          <span className="sr-only">{t('uploadTitle')}</span>
          <button
            type="button"
            className="button button--primary"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? '…' : t('uploadButton')}
          </button>
          <p className="drop-zone__hint">{t('orDrop')}</p>
          <p className="drop-zone__subhint">{t('uploadFormats')}</p>
          <p className="drop-zone__support">{t('uploadFormatsSupport')}</p>
        </label>
        <input
          id="upload-input"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/heic,image/heif"
          className="drop-zone__file"
          aria-label={t('uploadButton')}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {error ? <ErrorBanner message={error} /> : null}
    </section>
  );
};
