import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { ParsedMetadata, BasicFileInfo } from '../types/metadata';
import { formatLocalDateTime } from '../utils/datetime';

interface Props {
  metadata: ParsedMetadata | null;
  info: BasicFileInfo | null;
}

const MetadataPanel: React.FC<Props> = ({ metadata }) => {
  const { t } = useLanguage();

  if (!metadata) {
    return (
      <div className="panel" style={{ minWidth: 320 }}>
        <h2>{t('metadata_summary')}</h2>
        <p style={{ opacity: 0.65 }}>{t('metadata_no_data')}</p>
      </div>
    );
  }

  const { exif, counts, completeness } = metadata;
  const qualityColor = completeness.percent >= 70 ? '#4ade80' : completeness.percent >= 40 ? '#facc15' : '#f87171';

  return (
    <div className="panel" style={{ minWidth: 320 }}>
      <h2>{t('metadata_summary')}</h2>
      <dl className="table-like">
        <dt>{t('metadata_exif')}</dt>
        <dd>{counts.exif}</dd>
        <dt>{t('metadata_xmp')}</dt>
        <dd>{counts.xmp}</dd>
        <dt>{t('metadata_iptc')}</dt>
        <dd>{counts.iptc}</dd>
        <dt>{t('metadata_icc')}</dt>
        <dd>{counts.icc}</dd>
      </dl>

      <h3 style={{ marginTop: '1.5rem' }}>{t('metadata_camera')}</h3>
      <dl className="table-like">
        <dt>{t('metadata_camera_make')}</dt>
        <dd>{exif.make ?? '—'}</dd>
        <dt>{t('metadata_camera_model')}</dt>
        <dd>{exif.model ?? '—'}</dd>
        <dt>{t('metadata_lens_model')}</dt>
        <dd>{exif.lensModel ?? '—'}</dd>
        <dt>{t('metadata_exposure')}</dt>
        <dd>{exif.exposureTime ?? '—'}</dd>
        <dt>{t('metadata_aperture')}</dt>
        <dd>{exif.fNumber ? `f/${exif.fNumber}` : '—'}</dd>
        <dt>{t('metadata_iso')}</dt>
        <dd>{exif.iso ?? '—'}</dd>
        <dt>{t('metadata_focal')}</dt>
        <dd>{exif.focalLength ? `${exif.focalLength}mm` : '—'}</dd>
        <dt>{t('metadata_gps')}</dt>
        <dd>{exif.gpsLatitude && exif.gpsLongitude ? `${exif.gpsLatitude.toFixed(5)}, ${exif.gpsLongitude.toFixed(5)}` : '—'}</dd>
        <dt>{t('metadata_time')}</dt>
        <dd>{exif.dateTimeOriginal ? formatLocalDateTime(exif.dateTimeOriginal) : '—'}</dd>
      </dl>

      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>{t('metadata_completeness')}</p>
        <div style={{
          height: 12,
          borderRadius: 999,
          background: 'rgba(148, 163, 184, 0.2)',
          overflow: 'hidden'
        }}>
          <div
            style={{
              width: `${completeness.percent}%`,
              height: '100%',
              background: qualityColor,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
        <p style={{ marginTop: '0.5rem' }}>{completeness.percent}%</p>
      </div>
    </div>
  );
};

export default MetadataPanel;
