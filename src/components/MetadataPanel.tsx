import React from 'react';
import { useI18n, useT } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import { formatBytes, formatDimensions, formatMegapixels, formatDate, formatPercent } from '../utils/format';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ fileInfo, metadata }) => {
  const t = useT();
  const { lang } = useI18n();

  const locale = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US';
  const nameWithoutExtension = fileInfo.file.name.replace(/\.[^/.]+$/, '');
  const humanSize = formatBytes(fileInfo.sizeBytes);
  const rawBytes = new Intl.NumberFormat(locale).format(fileInfo.sizeBytes);
  const typeGeneric = fileInfo.mimeType.startsWith('image/') ? t('fileTypeImage') : t('fileTypeBinary');
  const format = describeFormat(fileInfo.mimeType);
  const orientationKey = metadata?.orientation
    ? (`orientation${capitalize(metadata.orientation)}` as const)
    : 'orientationUnknown';
  const gpsAccuracy = metadata?.gps?.accuracy;

  return (
    <aside className="panel" aria-label="Metadata">
      <h2 className="section-title">{t('basicInfoTitle')}</h2>
      <div className="metadata-grid">
        <MetadataItem label={t('nameLabel')} value={nameWithoutExtension} />
        <MetadataItem label={t('typeLabel')} value={typeGeneric} />
        <MetadataItem label={t('formatLabel')} value={format} />
        <MetadataItem label={t('sizeLabel')} value={t('sizeValue', { human: humanSize, bytes: rawBytes })} />
        <MetadataItem label={t('dimensionsLabel')} value={`${formatDimensions(fileInfo.width, fileInfo.height)}`} />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={t(orientationKey)} />
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
          <MetadataItem
            label={t('gpsAccuracy')}
            value={
              gpsAccuracy != null
                ? t('accuracyMeters', { value: Math.round(gpsAccuracy) })
                : t('emptyValue')
            }
          />
          <MetadataItem label={t('metadataCompleteness')} value={formatPercent(metadata.completeness)} />
        </div>
      ) : (
        <p className="notice">{t('metadataSummary')}</p>
      )}
    </aside>
  );
};

const MetadataItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="metadata-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeFormat(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes('jpeg')) return 'JPEG';
  if (normalized.includes('png')) return 'PNG';
  if (normalized.includes('webp')) return 'WebP';
  return mime.toUpperCase();
}
