import React, { useMemo } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import type { DetectionSummary } from '../types/detection';
import {
  formatBytes,
  formatDimensions,
  formatMegapixels,
  formatExactBytes,
  describeFileType,
  formatLocalizedDateTime,
  formatSceneCounts
} from '../utils/format';
import { inferCameraPosition } from '../utils/insights';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
  analysis: {
    summary: DetectionSummary | null;
    loading: boolean;
    error: string | null;
  };
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ fileInfo, metadata, analysis }) => {
  const t = useT();
  const { lang, messages } = useI18n();

  const fileName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
  const { typeKey, format } = describeFileType(fileInfo.mimeType, fileInfo.file.name);
  const typeLabel = t(typeKey as MessageKey);
  const orientationKey = metadata?.orientation
    ? `orientation${capitalize(metadata.orientation)}`
    : 'orientationUnknown';
  const orientationLabel = capitalizeFirst(t(orientationKey as MessageKey));

  const metadataCount = useMemo(() => {
    if (!metadata) return 0;
    return Object.values(metadata.groups).reduce(
      (acc, group) => acc + Object.keys(group ?? {}).length,
      0
    );
  }, [metadata]);

  const cameraLine = useMemo(() => {
    if (!metadata) return t('emptyValue');
    const cameraPosition = inferCameraPosition(metadata);
    const positionKey = `cameraPlacement${capitalize(cameraPosition)}` as MessageKey;
    const positionLabel = cameraPosition === 'unknown' ? '' : t(positionKey);
    const deviceLabel = [metadata.cameraMake, metadata.cameraModel]
      .filter(Boolean)
      .join(' ')
      .trim();
    const lens = metadata.lensModel ? metadata.lensModel.trim() : '';
    const parts = [deviceLabel, positionLabel, lens].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : t('emptyValue');
  }, [metadata, t]);

  const sceneDescription = useMemo(() => {
    if (analysis.loading) return t('sceneDescriptionLoading');
    if (analysis.error) return analysis.error;
    if (!analysis.summary) return t('sceneDescriptionEmpty');
    const segments = formatSceneCounts(analysis.summary, lang, messages, t);
    if (segments.length === 0) {
      return t('sceneDescriptionEmpty');
    }
    return `${t('sceneSummaryPrefix')} ${segments.join(', ')}`;
  }, [analysis.error, analysis.loading, analysis.summary, lang, t]);

  const shotDate = formatLocalizedDateTime(metadata?.shotDate, lang) ?? t('emptyValue');
  const metadataFieldsValue = metadata ? metadataCount.toString() : t('emptyValue');

  return (
    <aside className="panel" aria-label="Metadata">
      <h2 className="section-title">{t('basicInfoTitle')}</h2>
      <div className="metadata-grid">
        <MetadataItem label={t('nameLabel')} value={fileName || fileInfo.file.name} />
        <MetadataItem label={t('typeLabel')} value={typeLabel} />
        <MetadataItem label={t('formatLabel')} value={format} />
        <MetadataItem
          label={t('sizeLabel')}
          value={`${formatBytes(fileInfo.sizeBytes)} · ${t('sizeExactBytes', {
            value: formatExactBytes(fileInfo.sizeBytes)
          })}`}
        />
        <MetadataItem label={t('resolutionLabel')} value={`${formatDimensions(fileInfo.width, fileInfo.height)}`} />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={orientationLabel} />
        <MetadataItem label={t('sceneDescriptionLabel')} value={sceneDescription} />
        <MetadataItem label={t('shotDate')} value={shotDate} />
        <MetadataItem label={t('cameraCombinedLabel')} value={cameraLine} />
        <MetadataItem label={t('metadataFieldsLabel')} value={metadataFieldsValue} />
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

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
