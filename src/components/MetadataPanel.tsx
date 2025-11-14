import React from 'react';
import { useT } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import { formatBytes, formatDimensions, formatMegapixels, formatDate, formatPercent, formatAccuracy } from '../utils/format';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ fileInfo, metadata }) => {
  const t = useT();

  return (
    <aside className="panel" aria-label="Metadata">
      <h2 className="section-title">{t('basicInfoTitle')}</h2>
      <div className="metadata-grid">
        <MetadataItem label={t('nameLabel')} value={fileInfo.file.name} />
        <MetadataItem label={t('typeLabel')} value={fileInfo.mimeType} />
        <MetadataItem label={t('sizeLabel')} value={`${formatBytes(fileInfo.sizeBytes)} (${(fileInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`} />
        <MetadataItem label={t('dimensionsLabel')} value={`${formatDimensions(fileInfo.width, fileInfo.height)}`} />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={metadata ? t(`orientation${capitalize(metadata.orientation ?? 'unknown')}` as any) : t('orientationUnknown')} />
      </div>

      <h3 className="section-title" style={{ marginTop: '1.5rem', fontSize: '1.2rem' }}>
        {t('metadataSummary')}
      </h3>
      {metadata ? (
        <div className="metadata-grid">
          <MetadataItem label={t('exifGroup')} value={Object.keys(metadata.groups.exif ?? {}).length.toString()} />
          <MetadataItem label={t('xmpGroup')} value={Object.keys(metadata.groups.xmp ?? {}).length.toString()} />
          <MetadataItem label={t('iptcGroup')} value={Object.keys(metadata.groups.iptc ?? {}).length.toString()} />
          <MetadataItem label={t('iccGroup')} value={Object.keys(metadata.groups.icc ?? {}).length.toString()} />
          <MetadataItem label={t('shotDate')} value={formatDate(metadata.shotDate) ?? t('emptyValue')} />
          <MetadataItem label={t('cameraMake')} value={metadata.cameraMake ?? t('emptyValue')} />
          <MetadataItem label={t('cameraModel')} value={metadata.cameraModel ?? t('emptyValue')} />
          <MetadataItem label={t('lensModel')} value={metadata.lensModel ?? t('emptyValue')} />
          <MetadataItem label={t('exposure')} value={metadata.exposureTime ?? t('emptyValue')} />
          <MetadataItem label={t('aperture')} value={metadata.aperture ? `ƒ/${metadata.aperture}` : t('emptyValue')} />
          <MetadataItem label={t('iso')} value={metadata.iso ? metadata.iso.toString() : t('emptyValue')} />
          <MetadataItem label={t('focalLength')} value={metadata.focalLength ? `${metadata.focalLength}mm` : t('emptyValue')} />
          <MetadataItem
            label={t('gpsPresence')}
            value={metadata.gps ? t('gpsAvailable') : t('gpsMissing')}
          />
          <MetadataItem label={t('gpsAccuracy')} value={formatAccuracy(metadata.gps?.accuracy) ?? t('emptyValue')} />
          <MetadataItem label={t('metadataCompleteness')} value={formatPercent(metadata.completeness)} />
        </div>
      ) : (
        <p className="notice">{t('metadataSummary')}</p>
      )}
    </aside>
  );
};

const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="metadata-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
