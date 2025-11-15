import React, { useMemo } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import type { DetectionSummary } from '../types/detection';
import {
  formatBytes,
  formatDimensions,
  formatMegapixels,
  formatDetailedDate,
  formatExactBytes,
  describeFileType
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
  const { lang } = useI18n();

  const fileName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
  const { typeKey, format } = describeFileType(fileInfo.mimeType, fileInfo.file.name);
  const typeLabel = t(typeKey as MessageKey);
  const orientationKey = metadata?.orientation
    ? `orientation${capitalize(metadata.orientation)}`
    : 'orientationUnknown';

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
    const position = inferCameraPosition(metadata);
    const positionKey =
      position === 'front'
        ? 'cameraPositionFrontShort'
        : position === 'rear'
        ? 'cameraPositionRearShort'
        : position === 'unknown'
        ? 'cameraPositionUnknownShort'
        : null;
    const positionLabel = positionKey ? t(positionKey as MessageKey) : '';

    const parts = [makeModel].filter(Boolean);
    if (position !== 'unknown' && positionLabel) {
      parts.push(positionLabel);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }

    if (position === 'unknown' && positionLabel && positionLabel !== t('cameraPositionUnknownShort')) {
      return positionLabel;
    }

    return null;
  }, [metadata, t]);

  const shotDate = metadata ? formatDetailedDate(metadata.shotDate, lang) : undefined;

  const sceneDescription = useMemo(() => {
    if (analysis.loading) return t('sceneDescriptionLoading');
    if (analysis.error) return t('sceneDescriptionUnavailable');
    if (!analysis.summary) return t('sceneDescriptionEmpty');
    const segments: string[] = [];
    if (analysis.summary.people > 0) {
      segments.push(formatDetection(lang, analysis.summary.people, 'people'));
    }
    if (analysis.summary.vehicles > 0) {
      segments.push(formatDetection(lang, analysis.summary.vehicles, 'vehicles'));
    }
    if (analysis.summary.animals > 0) {
      segments.push(formatDetection(lang, analysis.summary.animals, 'animals'));
    }
    if (segments.length === 0) {
      return t('sceneDescriptionEmpty');
    }
    return t('sceneDescriptionDetected', { items: segments.join(', ') });
  }, [analysis.loading, analysis.error, analysis.summary, lang, t]);

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
        <MetadataItem label={t('resolutionLabel')} value={formatDimensions(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={t(orientationKey as any)} />
        <MetadataItem label={t('metadataFieldsLabel')} value={formattedFieldCount} />
        <MetadataItem label={t('shotDate')} value={shotDate ?? t('emptyValue')} />
        <MetadataItem label={t('cameraSummaryLabel')} value={cameraSummary ?? t('emptyValue')} />
        <MetadataItem label={t('sceneDescriptionLabel')} value={sceneDescription} />
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

type DetectionType = 'people' | 'vehicles' | 'animals';

const detectionForms: Record<'ru' | 'en' | 'uz', Record<DetectionType, Record<string, string>>> = {
  ru: {
    people: { one: 'человек', few: 'человека', many: 'человек', other: 'человек' },
    vehicles: {
      one: 'транспортное средство',
      few: 'транспортных средства',
      many: 'транспортных средств',
      other: 'транспортных средств'
    },
    animals: { one: 'животное', few: 'животных', many: 'животных', other: 'животных' }
  },
  en: {
    people: { one: 'person', other: 'people' },
    vehicles: { one: 'vehicle', other: 'vehicles' },
    animals: { one: 'animal', other: 'animals' }
  },
  uz: {
    people: { one: 'kishi', other: 'kishi' },
    vehicles: { one: 'transport vositasi', other: 'transport vositasi' },
    animals: { one: 'hayvon', other: 'hayvon' }
  }
};

function formatDetection(lang: 'ru' | 'en' | 'uz', count: number, type: DetectionType): string {
  const rules = new Intl.PluralRules(lang);
  const category = rules.select(count);
  const forms = detectionForms[lang][type];
  const noun = forms[category] ?? forms.other ?? forms.one;
  return `${count} ${noun}`;
}
