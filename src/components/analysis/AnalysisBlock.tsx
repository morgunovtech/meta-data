import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { DetectionSummary } from '../../types/detection';

interface Props {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  summary: DetectionSummary | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
  showBoxes: boolean;
  setShowBoxes: (value: boolean) => void;
  hasImage: boolean;
}

const AnalysisBlock: React.FC<Props> = ({
  enabled,
  setEnabled,
  summary,
  loading,
  error,
  onAnalyze,
  showBoxes,
  setShowBoxes,
  hasImage
}) => {
  const { t } = useLanguage();
  return (
    <section className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h2>{t('analysis_title')}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-label={t('analysis_toggle')}
          />
          {t('analysis_toggle')}
        </label>
      </div>

      {!enabled && <p style={{ opacity: 0.7 }}>{t('analysis_no_results')}</p>}
      {enabled && !hasImage && <p style={{ opacity: 0.7 }}>{t('cleanup_ready')}</p>}
      {enabled && hasImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <button className="button-primary" type="button" onClick={onAnalyze} disabled={loading}>
            {loading ? t('analysis_loading') : t('analysis_toggle')}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={showBoxes} onChange={(event) => setShowBoxes(event.target.checked)} />
            {t('analysis_show_boxes')}
          </label>
        </div>
      )}

      {error && <p className="alert">{t('analysis_disabled')}</p>}

      {summary && (
        <div style={{ marginTop: '1rem' }}>
          <p>{summary.caption}</p>
          <div className="chip-list">
            {Object.entries(summary.counts).map(([label, count]) => (
              <span key={label} className="chip">
                {label}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default AnalysisBlock;
