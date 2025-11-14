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
  formatLocalizedDateTime
} from '../utils/format';
import { inferCameraPosition } from '../utils/insights';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
  analysis: {
    loading: boolean;
    error: string | null;
    summary: DetectionSummary | null;
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

  const cameraPosition = useMemo(() => inferCameraPosition(metadata), [metadata]);

  const sceneDescription = useMemo(() => {
    if (analysis.loading) return t('sceneDescriptionLoading');
    if (analysis.error) return t('sceneDescriptionError');
    if (!analysis.summary) return t('sceneDescriptionNone');
    const parts: string[] = [];
    const pluralRules = new Intl.PluralRules(lang === 'ru' ? 'ru' : 'en');
    const dictionary = messages.detectionLabels;

    const formatCount = (key: keyof typeof dictionary, count: number) => {
      if (count <= 0) return;
      const forms = dictionary[key];
      if (!forms) return;
      const form = pluralRules.select(count) as keyof typeof forms;
      const template = forms[form] ?? forms.other;
      parts.push(template.replace('{count}', count.toString()));
    };

    formatCount('person', analysis.summary.people);
    formatCount('vehicle', analysis.summary.vehicles);

    const labelMap: Record<string, keyof typeof dictionary> = {
      dog: 'dog',
      cat: 'cat',
      car: 'car',
      bus: 'bus',
      truck: 'truck',
      bicycle: 'bicycle',
      motorcycle: 'motorcycle',
      train: 'train',
      bird: 'bird',
      horse: 'horse',
      sheep: 'sheep',
      cow: 'cow'
    };

    let hasAnimalSpecific = false;

    Object.entries(analysis.summary.labels)
      .filter(([label]) => labelMap[label])
      .sort(([, a], [, b]) => b - a)
      .forEach(([label, count]) => {
        const key = labelMap[label];
        if (!key) return;
        if (['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(label)) {
          hasAnimalSpecific = true;
        }
        formatCount(key, count);
      });

    if (analysis.summary.animals > 0 && !hasAnimalSpecific) {
      formatCount('animal', analysis.summary.animals);
    }

    if (parts.length === 0) {
      return t('sceneDescriptionNone');
    }
    return t('sceneDescriptionValue', { list: parts.join(', ') });
  }, [analysis, lang, messages.detectionLabels, t]);

  const localizedShotDate = useMemo(() => {
    if (!metadata?.shotDate) return null;
    const base = new Date(metadata.shotDate);
    if (Number.isNaN(base.getTime())) return null;
    const hasOffset = metadata.shotOffsetMinutes != null;
    const adjusted = hasOffset ? new Date(base.getTime() + metadata.shotOffsetMinutes * 60 * 1000) : base;
    const formatted = formatLocalizedDateTime(adjusted, lang, hasOffset ? 'UTC' : undefined);
    const timezoneLabel = hasOffset ? formatOffset(metadata.shotOffsetMinutes!) : undefined;
    return {
      text: formatted?.formatted ?? adjusted.toLocaleString(),
      timezone: timezoneLabel
    };
  }, [metadata?.shotDate, metadata?.shotOffsetMinutes, lang]);

  const cameraLabel = useMemo(() => {
    if (!metadata?.cameraMake && !metadata?.cameraModel) return t('emptyValue');
    const positionKey =
      cameraPosition === 'front'
        ? 'cameraPositionFront'
        : cameraPosition === 'rear'
        ? 'cameraPositionRear'
        : 'cameraPositionUnknown';
    const deviceName = [metadata?.cameraMake, metadata?.cameraModel].filter(Boolean).join(' ');
    return `${deviceName}${deviceName ? ', ' : ''}${t(positionKey as MessageKey)}`;
  }, [metadata?.cameraMake, metadata?.cameraModel, cameraPosition, t]);

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
        <MetadataItem label={t('orientationLabel')} value={t(orientationKey as any)} />
        {metadata ? (
          <MetadataItem label={t('metadataFields')} value={metadata.fieldCount.toString()} />
        ) : null}
        {localizedShotDate ? (
          <MetadataItem
            label={t('shotDate')}
            value={
              localizedShotDate.timezone
                ? `${localizedShotDate.text} (${localizedShotDate.timezone})`
                : localizedShotDate.text
            }
          />
        ) : null}
        {metadata ? <MetadataItem label={t('deviceLabel')} value={cameraLabel} /> : null}
        <MetadataItem label={t('sceneDescriptionLabel')} value={sceneDescription} />
      </div>
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

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (abs % 60).toString().padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}
