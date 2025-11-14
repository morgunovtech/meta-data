import React from 'react';
import type { DetectedObject } from '@/types/analysis';
import { useI18n } from '@/i18n/I18nContext';

export type ContentAnalysisBlockProps = {
  enabled: boolean;
  loading: boolean;
  supported: boolean;
  summary?: string;
  detections: DetectedObject[];
  summaryMetrics: { people: number; animals: number; vehicles: number };
  showBoxes: boolean;
  onToggle: (value: boolean) => void;
  onToggleBoxes: (value: boolean) => void;
};

export const ContentAnalysisBlock: React.FC<ContentAnalysisBlockProps> = ({
  enabled,
  loading,
  supported,
  summary,
  detections,
  summaryMetrics,
  showBoxes,
  onToggle,
  onToggleBoxes
}) => {
  const { t } = useI18n();

  return (
    <section className="content-analysis">
      <h2>{t('analysis_title')}</h2>
      <label className="toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
        <span>{t('analysis_toggle')}</span>
      </label>
      {!supported && enabled && <p>{t('analysis_disabled')}</p>}
      {loading && <p>{t('analysis_loading')}</p>}
      {summary && <p>{t('analysis_summary')}: {summary}</p>}
      {detections.length > 0 && (
        <ul>
          <li>{t('metrics_people', { count: summaryMetrics.people })}</li>
          <li>{t('metrics_animals', { count: summaryMetrics.animals })}</li>
          <li>{t('metrics_vehicles', { count: summaryMetrics.vehicles })}</li>
        </ul>
      )}
      {enabled && supported && (
        <label className="toggle">
          <input type="checkbox" checked={showBoxes} onChange={(event) => onToggleBoxes(event.target.checked)} />
          <span>{t('analysis_boxes')}</span>
        </label>
      )}
    </section>
  );
};
