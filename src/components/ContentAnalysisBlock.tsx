import React from 'react';
import type { DetectionSummary } from '../types/detection';
import { useT } from '../i18n';

interface ContentAnalysisBlockProps {
  loading: boolean;
  error: string | null;
  summary: DetectionSummary | null;
}

export const ContentAnalysisBlock: React.FC<ContentAnalysisBlockProps> = ({ loading, error, summary }) => {
  const t = useT();
  const nothingDetected =
    summary != null && summary.people === 0 && summary.vehicles === 0 && summary.animals === 0 && !summary.description;
  return (
    <section className="panel">
      <h2 className="section-title">{t('contentAnalysisTitle')}</h2>
      {loading ? <p>{t('contentLoading')}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {summary ? (
        <div>
          <p>{t('contentResults')}</p>
          {nothingDetected ? <p className="notice">{t('contentNoDetections')}</p> : null}
          <p>
            {summary.description || t('emptyValue')}
            <br />
            {t('modelSummary', {
              people: summary.people,
              vehicles: summary.vehicles,
              animals: summary.animals
            })}
          </p>
        </div>
      ) : !loading && !error ? (
        <p className="notice">{t('contentNoDetections')}</p>
      ) : null}
    </section>
  );
};
