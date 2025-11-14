import React, { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { MAX_FILE_SIZE_BYTES } from '@/utils/file';

export type UploadDropZoneProps = {
  onFileSelect: (file: File) => void;
  busy?: boolean;
};

export const UploadDropZone: React.FC<UploadDropZoneProps> = ({ onFileSelect, busy }) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      onFileSelect(fileList[0]);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (busy) return;
      const file = event.dataTransfer.files?.[0];
      if (file) handleFile(event.dataTransfer.files);
    },
    [busy, handleFile]
  );

  return (
    <div
      className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (busy) return;
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <p>{t('upload_drop')} <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>{t('upload_button')}</button></p>
      <p className="hint">{t('upload_formats')}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => handleFile(event.target.files)}
        disabled={busy}
        hidden
      />
      <p className="limit">{t('upload_limit', { limit: (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0) })}</p>
    </div>
  );
};
