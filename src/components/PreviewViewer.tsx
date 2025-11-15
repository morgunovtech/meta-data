import React, { useMemo, useState } from 'react';
import type { BasicFileInfo } from '../types/metadata';
import type { BoundingBox, DetectionSummary } from '../types/detection';
import { useI18n, useT } from '../i18n';

interface PreviewViewerProps {
  fileInfo: BasicFileInfo;
  detections: BoundingBox[];
  summary: DetectionSummary | null;
  loading: boolean;
  error: string | null;
}

export const PreviewViewer: React.FC<PreviewViewerProps> = ({ fileInfo, detections, summary, loading, error }) => {
  const t = useT();
  const { lang } = useI18n();
  const [fullScreen, setFullScreen] = useState(false);

  const overlays = useMemo(() => {
    return detections
      .filter((det) => det.score >= 0.5)
      .map((det, index) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${(det.x / fileInfo.width) * 100}%`,
          top: `${(det.y / fileInfo.height) * 100}%`,
          width: `${(det.width / fileInfo.width) * 100}%`,
          height: `${(det.height / fileInfo.height) * 100}%`,
          border: '2px solid rgba(56,189,248,0.8)',
          borderRadius: '8px',
          boxShadow: '0 0 12px rgba(56,189,248,0.6)',
          pointerEvents: 'none'
        };
        return (
          <div key={`${det.label}-${index}`} style={style} aria-hidden="true">
            <span
              style={{
                position: 'absolute',
                top: '-1.5rem',
                left: 0,
                padding: '0.2rem 0.4rem',
                background: 'rgba(15,23,42,0.9)',
                color: '#e2e8f0',
                fontSize: '0.7rem',
                borderRadius: '6px'
              }}
            >
              {det.label}
            </span>
          </div>
        );
      });
  }, [detections, fileInfo.height, fileInfo.width]);

  const detectionDescription = useMemo(() => {
    if (loading) return t('sceneDescriptionLoading');
    if (error) return t('sceneDescriptionUnavailable');
    if (!summary) return t('sceneDescriptionEmpty');
    const segments: string[] = [];
    if (summary.people > 0) {
      segments.push(formatDetection(lang, summary.people, 'people'));
    }
    if (summary.vehicles > 0) {
      segments.push(formatDetection(lang, summary.vehicles, 'vehicles'));
    }
    if (summary.animals > 0) {
      segments.push(formatDetection(lang, summary.animals, 'animals'));
    }
    if (segments.length === 0) {
      return t('sceneDescriptionEmpty');
    }
    return t('sceneDescriptionDetected', { items: segments.join(', ') });
  }, [error, lang, loading, summary, t]);

  const recognisedText = useMemo(() => {
    if (!summary || summary.textSnippets.length === 0) {
      return null;
    }
    const joined = summary.textSnippets.join(', ');
    return t('sceneTextDetected', { text: joined });
  }, [summary, t]);

  return (
    <div className="preview-panel">
      <div className="preview-wrapper" role="img" aria-label={fileInfo.file.name} onClick={() => setFullScreen(true)}>
        <img src={fileInfo.thumbnailUrl} alt={fileInfo.file.name} style={{ width: '100%', height: 'auto' }} />
        <div style={{ position: 'absolute', inset: 0 }}>{overlays}</div>
      </div>
      <div className="scene-description">
        <h3>{t('sceneDescriptionLabel')}</h3>
        <p>{detectionDescription}</p>
        {recognisedText ? <p className="scene-description__text">{recognisedText}</p> : null}
      </div>
      {fullScreen ? (
        <div className="fullscreen-viewer" onClick={() => setFullScreen(false)}>
          <div className="fullscreen-inner">
            <button type="button" className="fullscreen-close" onClick={() => setFullScreen(false)}>
              {t('fullscreenClose')}
            </button>
            <div className="fullscreen-media">
              <img src={fileInfo.dataUrl} alt={fileInfo.file.name} />
              <div className="fullscreen-overlays">{overlays}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

type DetectionType = 'people' | 'vehicles' | 'animals';

const detectionForms: Record<'ru' | 'en' | 'uz', Record<DetectionType, Record<string, string>>> = {
  ru: {
    people: { one: 'человек', few: 'человека', many: 'человек', other: 'человек' },
    vehicles: { one: 'транспортное средство', few: 'транспортных средства', many: 'транспортных средств', other: 'транспортных средств' },
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
