import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { DetectionSummary } from '../types/detection';

export type ContentAnalysisProps = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  supported: boolean;
  loading: boolean;
  error?: string;
  summary?: DetectionSummary;
  showBoxes: boolean;
  setShowBoxes: (value: boolean) => void;
  onAnalyze: (image: HTMLImageElement) => void;
  imageSrc?: string;
};

export const ContentAnalysisBlock: React.FC<ContentAnalysisProps> = ({
  enabled,
  setEnabled,
  supported,
  loading,
  error,
  summary,
  showBoxes,
  setShowBoxes,
  onAnalyze,
  imageSrc
}) => {
  const { t } = useI18n();
  const hiddenImage = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!enabled || !imageSrc || !hiddenImage.current) return;
    if (!supported) return;
    if (!hiddenImage.current.complete) {
      hiddenImage.current.onload = () => {
        if (hiddenImage.current) onAnalyze(hiddenImage.current);
      };
      return;
    }
    onAnalyze(hiddenImage.current);
  }, [enabled, imageSrc, onAnalyze, supported]);

  return (
    <section className="analysis-block">
      <header>
        <h2>{t('analysisTitle')}</h2>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={!supported}
          />
          {t('enableAnalysis')}
        </label>
      </header>
      {!supported && <p>{t('deviceWeak')}</p>}
      {enabled && imageSrc && (
        <>
          {loading && <p>{t('loading')}</p>}
          {error && <p className="error-text">{error === 'unsupported' ? t('deviceWeak') : error}</p>}
          {summary && (
            <div className="analysis-summary">
              <p>{t('analysisSummary')}: {summary.caption || '-'}</p>
              <ul>
                {Object.entries(summary.counts).map(([label, count]) => (
                  <li key={label}>
                    {label}: {count}
                  </li>
                ))}
              </ul>
              <label>
                <input type="checkbox" checked={showBoxes} onChange={(event) => setShowBoxes(event.target.checked)} />
                {t('toggleBoxes')}
              </label>
            </div>
          )}
          <img ref={hiddenImage} src={imageSrc} alt="analysis" style={{ display: 'none' }} />
        </>
      )}
    </section>
  );
};
