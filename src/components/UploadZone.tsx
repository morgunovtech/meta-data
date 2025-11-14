import React, { useCallback, useRef, useState } from 'react';
import { useT } from '../i18n';

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
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? '…' : t('uploadButton')}
        </button>
        <p>{t('orDrop')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {error ? <p className="error-banner" style={{ marginTop: '1rem' }}>{error}</p> : null}
    </section>
  );
};
