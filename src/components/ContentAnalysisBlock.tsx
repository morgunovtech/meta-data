import React, { useMemo } from 'react';
import type { DetectionSummary } from '../types/detection';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n';

const detectionLabelKeys: Record<string, MessageKey> = {
  person: 'objectPerson',
  car: 'objectCar',
  bus: 'objectBus',
  truck: 'objectTruck',
  bicycle: 'objectBicycle',
  motorcycle: 'objectMotorcycle',
  train: 'objectTrain',
  dog: 'objectDog',
  cat: 'objectCat',
  bird: 'objectBird',
  horse: 'objectHorse',
  sheep: 'objectSheep',
  cow: 'objectCow'
};

function formatDetectionLabel(label: string, translate: ReturnType<typeof useT>) {
  const key = detectionLabelKeys[label];
  if (key) return translate(key);
  return label.replace(/_/g, ' ');
}

interface ContentAnalysisBlockProps {
  loading: boolean;
  error: string | null;
  summary: DetectionSummary | null;
}

export const ContentAnalysisBlock: React.FC<ContentAnalysisBlockProps> = ({ loading, error, summary }) => {
  const t = useT();
  const topList = useMemo(() => {
    if (!summary?.top.length) return null;
    return summary.top.map((entry) => `${formatDetectionLabel(entry.label, t)} ×${entry.count}`);
  }, [summary, t]);

  return (
    <section className="panel">
      <h2 className="section-title">{t('contentAnalysisTitle')}</h2>
      {loading ? <p>{t('contentLoading')}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {!loading && !error && summary?.total ? (
        <div>
          <p>{t('contentResults')}</p>
          <p>
            {t('contentSummaryCounts', {
              people: summary.people,
              vehicles: summary.vehicles,
              animals: summary.animals
            })}
          </p>
          {topList ? (
            <p>{t('contentTopObjects', { list: topList.join(', ') })}</p>
          ) : (
            <p className="notice">{t('contentNoDetections')}</p>
          )}
          <p className="notice">{t('contentBoxesAuto')}</p>
        </div>
      ) : null}
      {!loading && !error && !summary?.total ? <p className="notice">{t('contentNoDetections')}</p> : null}
    </section>
  );
};
