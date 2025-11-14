import React, { useCallback, useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { ImageFileState } from '../hooks/useImageFile';

type Props = {
  imageState: ImageFileState;
  onFileSelected: (file: File) => void;
};

export const UploadZone: React.FC<Props> = ({ imageState, onFileSelected }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useI18n();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFileSelected(files[0]);
    },
    [onFileSelected]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
    },
    [handleFiles]
  );

  const openDialog = () => inputRef.current?.click();

  return (
    <div
      className="upload-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onClick={openDialog}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDialog();
        }
      }}
      aria-label={t('dropHint')}
    >
      <p>{t('dropHint')}</p>
      <button type="button" onClick={openDialog} className="primary">
        {t('uploadButton')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        hidden
        onChange={onInputChange}
      />
      {imageState.error && <p className="error-text">{imageState.error}</p>}
    </div>
  );
};
