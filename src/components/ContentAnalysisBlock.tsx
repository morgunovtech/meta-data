import React from 'react';
import type { BoundingBox, DetectionSummary } from '../types/detection';
import { useT } from '../i18n';

interface ContentAnalysisBlockProps {
  loading: boolean;
  error: string | null;
  summary: DetectionSummary | null;
  detections: BoundingBox[];
}

export const ContentAnalysisBlock: React.FC<ContentAnalysisBlockProps> = ({
  loading,
  error,
  summary,
  detections
}) => {
  const t = useT();
  return (
    <section className="panel">
      <h2 className="section-title">{t('contentAnalysisTitle')}</h2>
      <p className="notice">{t('contentAutoNote')}</p>
      {loading ? <p>{t('contentLoading')}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {summary ? (
        <div>
          <p className="content-summary__description">
            {summary.description ? t('contentDescription', { description: summary.description }) : t('emptyValue')}
          </p>
          <p>
            {t('modelSummary', {
              people: summary.people,
              vehicles: summary.vehicles,
              animals: summary.animals
            })}
          </p>
          <p className="notice">{t('contentBoxesInfo')}</p>
        </div>
      ) : null}
      {!loading && !error && detections.length === 0 ? <p className="notice">{t('contentNoDetections')}</p> : null}
    </section>
  );
};
