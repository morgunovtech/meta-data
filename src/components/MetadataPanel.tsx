import React, { useMemo } from 'react';
import { useI18n, useT, type MessageKey } from '../i18n';
import type { BasicFileInfo, StructuredMetadata } from '../types/metadata';
import type { DetectionSummary } from '../types/detection';
import {
  formatBytes,
  formatMegapixels,
  formatExactBytes,
  describeFileType,
  formatLocalizedDateTime
} from '../utils/format';
import { inferCameraPosition } from '../utils/insights';

interface MetadataPanelProps {
  fileInfo: BasicFileInfo;
  metadata: StructuredMetadata | null;
  analysisSummary: DetectionSummary | null;
  analysisLoading: boolean;
  analysisError: string | null;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  fileInfo,
  metadata,
  analysisSummary,
  analysisLoading,
  analysisError
}) => {
  const t = useT();
  const { lang } = useI18n();

  const fileName = fileInfo.file.name.replace(/\.[^/.]+$/, '');
  const { typeKey, format } = describeFileType(fileInfo.mimeType, fileInfo.file.name);
  const typeLabel = t(typeKey as MessageKey);
  const orientationKey = metadata?.orientation
    ? `orientation${capitalize(metadata.orientation)}`
    : 'orientationUnknown';

  const metadataFieldCount = useMemo(() => {
    if (!metadata) return null;
    return Object.values(metadata.groups).reduce((acc, group) => acc + Object.keys(group ?? {}).length, 0);
  }, [metadata]);

  const cameraPosition = useMemo(() => inferCameraPosition(metadata), [metadata]);
  const cameraValue = useMemo(() => {
    if (!metadata) return t('emptyValue');
    const device = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ');
    if (!device && !metadata.lensModel) {
      return t('emptyValue');
    }
    const facingKey =
      cameraPosition === 'front'
        ? 'cameraFacingFront'
        : cameraPosition === 'rear'
        ? 'cameraFacingRear'
        : null;
    if (device) {
      return facingKey ? `${device}, ${t(facingKey as MessageKey)}` : device;
    }
    return metadata.lensModel ?? t('emptyValue');
  }, [cameraPosition, metadata, t]);

  const shotDate = useMemo(
    () => formatLocalizedDateTime(metadata?.shotDate, lang) ?? t('emptyValue'),
    [metadata?.shotDate, lang, t]
  );

  const sceneDescription = useMemo(
    () => describeScene(analysisSummary, lang, t),
    [analysisSummary, lang, t]
  );

  return (
    <aside className="panel" aria-label="Metadata">
      <h2 className="section-title">{t('basicInfoTitle')}</h2>
      <div className="metadata-grid">
        <MetadataItem label={t('nameLabel')} value={fileName || fileInfo.file.name} />
        <MetadataItem label={t('typeLabel')} value={typeLabel} />
        <MetadataItem label={t('formatLabel')} value={format} />
        <MetadataItem
          label={t('sizeLabel')}
          value={`${formatBytes(fileInfo.sizeBytes)} (${t('sizeExactBytes', {
            value: formatExactBytes(fileInfo.sizeBytes)
          })})`}
        />
        <MetadataItem
          label={t('resolutionLabel')}
          value={`${fileInfo.width} × ${fileInfo.height}`}
        />
        <MetadataItem label={t('megapixelsLabel')} value={formatMegapixels(fileInfo.width, fileInfo.height)} />
        <MetadataItem label={t('orientationLabel')} value={t(orientationKey as any)} />
        {metadataFieldCount != null ? (
          <MetadataItem label={t('metadataFieldsLabel')} value={metadataFieldCount.toString()} />
        ) : null}
        <MetadataItem label={t('shotDate')} value={shotDate} />
        <MetadataItem label={t('cameraSummaryLabel')} value={cameraValue} />
        <MetadataItem
          label={t('sceneDescriptionLabel')}
          value={analysisLoading ? t('contentLoading') : analysisError ? analysisError : sceneDescription}
        />
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

function describeScene(summary: DetectionSummary | null, lang: string, t: ReturnType<typeof useT>): string {
  if (!summary) {
    return t('contentNoDetections');
  }
  const descriptions: string[] = [];
  const pluralRules = new Intl.PluralRules(lang);

  const pushForms = (count: number, forms: string) => {
    if (!count) return;
    const formParts = forms.split('|');
    const formIndex = selectPluralForm(pluralRules.select(count), formParts.length);
    const noun = formParts[formIndex] ?? formParts[formParts.length - 1];
    descriptions.push(`${count} ${noun}`);
  };

  const pushByKey = (count: number, key: MessageKey) => {
    if (!count) return;
    pushForms(count, t(key));
  };

  pushByKey(summary.people, 'sceneLabelPerson');
  pushByKey(summary.faces, 'sceneLabelFace');
  pushByKey(summary.vehicles, 'sceneLabelVehicle');

  const animalLabels = ['dog', 'cat', 'bird', 'horse'];
  animalLabels.forEach((key) => {
    const count = summary.labelCounts[key];
    if (count) {
      const candidateKey = `sceneLabel${capitalize(key)}` as MessageKey;
      const raw = t(candidateKey);
      if (raw === candidateKey) {
        pushForms(count, t('sceneLabelAnimal'));
      } else {
        pushForms(count, raw);
      }
    }
  });

  if (summary.animals && !animalLabels.some((key) => summary.labelCounts[key])) {
    pushByKey(summary.animals, 'sceneLabelAnimal');
  }

  const remaining = Object.entries(summary.labelCounts)
    .filter(([label]) => !['person', 'face', ...animalLabels, 'car', 'bus', 'truck', 'train', 'bicycle', 'motorcycle'].includes(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  remaining.forEach(([label, count]) => {
    if (!count) return;
    const candidateKey = `sceneLabel${capitalize(label)}` as MessageKey;
    const raw = t(candidateKey);
    if (raw === candidateKey) {
      pushByKey(count, 'sceneLabelUnknown');
    } else {
      pushForms(count, raw);
    }
  });

  if (descriptions.length === 0) {
    return t('contentNoDetections');
  }
  return `${t('sceneSummaryIntro')} ${descriptions.join(', ')}`;
}

function selectPluralForm(category: Intl.LDMLPluralRule, formsLength: number): number {
  switch (category) {
    case 'one':
      return 0;
    case 'few':
      return 1;
    case 'many':
      return formsLength > 2 ? 2 : formsLength - 1;
    default:
      return formsLength > 1 ? formsLength - 1 : 0;
  }
}
