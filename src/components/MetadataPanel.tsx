import React, { useCallback, useMemo } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import {
  formatBytes,
  formatDimensions,
  formatMegapixels,
  formatDetailedDate,
  describeFileType
} from '../utils/format';
import { extractSoftware, inferCameraPosition } from '../utils/insights';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ fileInfo, metadata }) => {
  const t = useT();
  const { lang } = useI18n();

  const fileName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
  const { typeKey, format } = describeFileType(fileInfo.mimeType, fileInfo.file.name);
  const typeLabel = t(typeKey as MessageKey);
  const orientationKey = useMemo(() => {
    if (metadata?.orientation) {
      return `orientation${capitalize(metadata.orientation)}`;
    }
    if (fileInfo.width === fileInfo.height) {
      return 'orientationSquare';
    }
    return fileInfo.width > fileInfo.height ? 'orientationLandscape' : 'orientationPortrait';
  }, [fileInfo.height, fileInfo.width, metadata?.orientation]);

  const formatLocaleNumber = useCallback(
    (value: number, fractionDigits = 1) => {
      try {
        const formatter = new Intl.NumberFormat(lang, {
          maximumFractionDigits: fractionDigits,
          minimumFractionDigits: value % 1 === 0 ? 0 : fractionDigits
        });
        return formatter.format(value);
      } catch (error) {
        return value.toFixed(fractionDigits);
      }
    },
    [lang]
  );

  const metadataFieldCount = useMemo(() => {
    if (!metadata) return 0;
    return ['exif', 'xmp', 'iptc', 'icc'].reduce((total, key) => {
      const group = metadata.groups[key as keyof typeof metadata.groups];
      return total + Object.keys(group ?? {}).length;
    }, 0);
  }, [metadata]);

  const formattedFieldCount = metadataFieldCount
    ? new Intl.NumberFormat(lang).format(metadataFieldCount)
    : t('emptyValue');

  const cameraSummary = useMemo(() => {
    if (!metadata) return null;
    const makeModel = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ').trim();
    const software = extractSoftware(metadata);
    const position = inferCameraPosition(metadata);
    const positionKey =
      position === 'front'
        ? 'cameraPositionFrontShort'
        : position === 'rear'
        ? 'cameraPositionRearShort'
        : null;
    const positionLabel = positionKey ? t(positionKey as MessageKey) : null;
    const focal = metadata.focalLength;
    const aperture = metadata.aperture;

    const parts: string[] = [];
    if (makeModel) parts.push(makeModel);
    if (software) parts.push(software);
    if (positionLabel) parts.push(positionLabel);
    if (focal) {
      parts.push(t('cameraFocal', { value: formatLocaleNumber(focal, focal < 10 ? 1 : 0) }));
    }
    if (aperture) {
      parts.push(t('cameraAperture', { value: formatLocaleNumber(aperture, 1) }));
    }
    return parts.length > 0 ? parts.join(', ') : null;
  }, [metadata, formatLocaleNumber, t]);

  const shotDate = metadata ? formatDetailedDate(metadata.shotDate, lang) : undefined;

  return (
    <aside className="panel" aria-label="Metadata">
      <h2 className="section-title">{t('basicInfoTitle')}</h2>
      <div className="metadata-grid">
        <MetadataItem label={t('nameLabel')} value={fileName || fileInfo.file.name} />
        <MetadataItem label={t('typeLabel')} value={typeLabel} />
        <MetadataItem label={t('formatLabel')} value={format} />
        <MetadataItem label={t('sizeLabel')} value={formatBytes(fileInfo.sizeBytes)} />
        <MetadataItem label={t('resolutionLabel')} value={formatDimensions(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={t(orientationKey as any)} />
        <MetadataItem label={t('metadataFieldsLabel')} value={formattedFieldCount} />
        <MetadataItem label={t('shotDate')} value={shotDate ?? t('emptyValue')} />
        <MetadataItem label={t('cameraSummaryLabel')} value={cameraSummary ?? t('emptyValue')} />
      </div>
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
