import React from 'react';
import type { ImageInfo } from '@/hooks/useImageFile';
import type { BasicExifData } from '@/types/exif';
import { useI18n } from '@/i18n/I18nContext';
import { formatFileSize, getMegapixels } from '@/utils/file';
import { formatDateTime } from '@/utils/date';

export type MetadataPanelProps = {
  image?: ImageInfo;
  metadata?: BasicExifData;
};

const formatOrientationKey = (orientation?: string) => {
  switch (orientation) {
    case 'landscape':
      return 'orientation_landscape';
    case 'portrait':
      return 'orientation_portrait';
    case 'square':
      return 'orientation_square';
    default:
      return 'orientation_unknown';
  }
};

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ image, metadata }) => {
  const { t } = useI18n();

  if (!image) {
    return null;
  }

  return (
    <aside className="metadata-panel">
      <section>
        <h3>{t('file_info_title')}</h3>
        <dl>
          <div>
            <dt>{t('file_name')}</dt>
            <dd>{image.name}</dd>
          </div>
          <div>
            <dt>{t('file_type')}</dt>
            <dd>{image.type}</dd>
          </div>
          <div>
            <dt>{t('file_size')}</dt>
            <dd>
              {formatFileSize(image.size)} ({image.size} B)
            </dd>
          </div>
          <div>
            <dt>{t('file_dimensions')}</dt>
            <dd>
              {image.width} × {image.height}
            </dd>
          </div>
          <div>
            <dt>{t('file_megapixels')}</dt>
            <dd>{getMegapixels(image.width, image.height)}</dd>
          </div>
          <div>
            <dt>{t('file_orientation')}</dt>
            <dd>{t(formatOrientationKey(image.orientation))}</dd>
          </div>
        </dl>
      </section>
      {metadata && (
        <section>
          <h3>{t('metadata_title')}</h3>
          <p>
            {t('metadata_counts', {
              exif: metadata.counts.exif,
              xmp: metadata.counts.xmp,
              iptc: metadata.counts.iptc,
              icc: metadata.counts.icc
            })}
          </p>
          <dl>
            <div>
              <dt>{t('metadata_datetime')}</dt>
              <dd>{formatDateTime(metadata.dateTimeOriginal) ?? t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_camera')}</dt>
              <dd>{metadata.make ? `${metadata.make} ${metadata.model ?? ''}` : metadata.model ?? t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_lens')}</dt>
              <dd>{metadata.lensModel ?? t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_exposure')}</dt>
              <dd>{metadata.exposureTime ?? t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_aperture')}</dt>
              <dd>{metadata.fNumber ? `f/${metadata.fNumber}` : t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_iso')}</dt>
              <dd>{metadata.iso ?? t('no_data')}</dd>
            </div>
            <div>
              <dt>{t('metadata_focal')}</dt>
              <dd>
                {metadata.focalLength ? `${metadata.focalLength} mm` : t('no_data')}
                {metadata.focalLengthIn35mmFormat && ` (${metadata.focalLengthIn35mmFormat}mm eq.)`}
              </dd>
            </div>
            <div>
              <dt>{t('metadata_gps')}</dt>
              <dd>
                {metadata.gps
                  ? `${metadata.gps.latitude.toFixed(5)}, ${metadata.gps.longitude.toFixed(5)}`
                  : t('no_data')}
              </dd>
            </div>
            <div>
              <dt>{t('metadata_accuracy')}</dt>
              <dd>
                {metadata.gps?.accuracyMeters ? `${metadata.gps.accuracyMeters.toFixed(0)} m` : t('no_data')}
              </dd>
            </div>
            <div>
              <dt>{t('metadata_completeness')}</dt>
              <dd>
                <span className={`badge badge-${metadata.completeness > 80 ? 'good' : metadata.completeness > 50 ? 'ok' : 'low'}`}>
                  {metadata.completeness}%
                </span>
              </dd>
            </div>
          </dl>
        </section>
      )}
    </aside>
  );
};
