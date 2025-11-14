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
  return (
    <section className="panel">
      <h2 className="section-title">{t('contentAnalysisTitle')}</h2>
      {loading ? <p>{t('contentLoading')}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {summary ? (
        <div>
          <p>
            <strong>{t('contentResults')}:</strong> {summary.description || t('emptyValue')}
          </p>
          <p>{t('modelSummary', { people: summary.people, vehicles: summary.vehicles, animals: summary.animals })}</p>
          <div>
            <p className="section-subtitle">{t('contentTopObjects')}</p>
            {summary.top?.length ? (
              <ul className="inline-list">
                {summary.top.map((item) => (
                  <li key={item.label}>
                    {item.label} · {item.count} · {Math.round(item.confidence * 100)}%
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice">{t('contentNoDetections')}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
