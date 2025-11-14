import React from 'react';
import type { ImageFileState } from '../hooks/useImageFile';
import type { ExifState } from '../hooks/useExifMetadata';
import { useI18n } from '../i18n/I18nContext';
import { formatDate } from '../utils/date';

export const MetadataPanel: React.FC<{ image: ImageFileState; exif: ExifState }> = ({ image, exif }) => {
  const { t, locale } = useI18n();
  const info = image.info;
  const metadata = exif.metadata;

  return (
    <section className="metadata-panel">
      <h2>{t('fileInfoTitle')}</h2>
      <dl>
        {info.name && (
          <>
            <dt>File</dt>
            <dd>{info.name}</dd>
          </>
        )}
        {info.mimeType && (
          <>
            <dt>MIME</dt>
            <dd>{info.mimeType}</dd>
          </>
        )}
        {info.size !== undefined && (
          <>
            <dt>Size</dt>
            <dd>
              {info.formattedSize} ({info.size.toLocaleString()} B)
            </dd>
          </>
        )}
        {info.width && info.height && (
          <>
            <dt>Dimensions</dt>
            <dd>
              {info.width} × {info.height}
            </dd>
          </>
        )}
        {info.megapixels !== undefined && (
          <>
            <dt>MP</dt>
            <dd>{info.megapixels}</dd>
          </>
        )}
        {info.orientation && (
          <>
            <dt>Orientation</dt>
            <dd>{info.orientation}</dd>
          </>
        )}
      </dl>

      <h2>{t('metadataTitle')}</h2>
      {metadata ? (
        <div className="metadata-grid">
          <div>
            <h3>EXIF</h3>
            <p>{metadata.groups.exif}</p>
          </div>
          <div>
            <h3>XMP</h3>
            <p>{metadata.groups.xmp}</p>
          </div>
          <div>
            <h3>IPTC</h3>
            <p>{metadata.groups.iptc}</p>
          </div>
          <div>
            <h3>ICC</h3>
            <p>{metadata.groups.icc}</p>
          </div>
        </div>
      ) : (
        <p>{exif.loading ? t('loading') : '-'}</p>
      )}

      {metadata && (
        <div className="metadata-details">
          <p>
            {metadata.camera.make} {metadata.camera.model} {metadata.camera.lensModel && `· ${metadata.camera.lensModel}`}
          </p>
          <p>
            {metadata.camera.exposureTime && `1/${metadata.camera.exposureTime}`}{' '}
            {metadata.camera.aperture && `· f/${metadata.camera.aperture}`}{' '}
            {metadata.camera.iso && `· ISO ${metadata.camera.iso}`}{' '}
            {metadata.camera.focalLength && `· ${metadata.camera.focalLength}mm`}
          </p>
          <p>
            {metadata.camera.dateTimeOriginal
              ? formatDate(metadata.camera.dateTimeOriginal, locale)
              : t('noTimeData')}
          </p>
          <p>
            {t('metadataCompleteness')}: {metadata.completeness.percentage}%
          </p>
        </div>
      )}
    </section>
  );
};
