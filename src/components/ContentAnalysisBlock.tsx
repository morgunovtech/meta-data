import React from 'react';
import type { DetectionSummary } from '../types/detection';
import { useT } from '../i18n';

interface ContentAnalysisBlockProps {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  summary: DetectionSummary | null;
  showBoxes: boolean;
  onToggleBoxes: (value: boolean) => void;
}

export const ContentAnalysisBlock: React.FC<ContentAnalysisBlockProps> = ({
  enabled,
  setEnabled,
  loading,
  error,
  summary,
  showBoxes,
  onToggleBoxes
}) => {
  const t = useT();
  return (
    <section className="panel">
      <div className="title-row">
        <h2 className="section-title">{t('contentAnalysisTitle')}</h2>
        <label>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          {t('contentToggle')}
        </label>
      </div>
      {loading ? <p>{t('contentLoading')}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {summary ? (
        <div>
          <p>{t('contentResults')}</p>
          <p>
            {summary.description || t('emptyValue')}
            <br />
            {t('modelSummary', {
              people: summary.people,
              vehicles: summary.vehicles,
              animals: summary.animals
            })}
          </p>
          <label>
            <input type="checkbox" checked={showBoxes} onChange={(event) => onToggleBoxes(event.target.checked)} />
            {t('showBoxes')}
          </label>
        </div>
      ) : null}
    </section>
  );
};
