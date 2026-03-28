import React, { useState } from 'react';
import { useT } from '../i18n';
import type { OCRResult } from '../hooks/useOCR';

interface OCRBlockProps {
  result: OCRResult | null;
  loading: boolean;
  error: string | null;
  progress: { label: string; value: number } | null;
}

export const OCRBlock: React.FC<OCRBlockProps> = ({ result, loading, error, progress }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (!loading && !error && !result) return null;

  return (
    <section className="panel ocr-panel">
      <h3>{t('ocrTitle')}</h3>

      {loading && progress ? (
        <div className="progress-row" aria-live="polite">
          <div className="progress-text">{progress.label}</div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.value * 100)}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, progress.value * 100))}%` }} />
          </div>
        </div>
      ) : null}

      {error ? <p className="insight-compact__muted">{error}</p> : null}

      {result && !loading ? (
        result.fullText.length === 0 ? (
          <p className="insight-compact__muted">{t('ocrEmpty')}</p>
        ) : (
          <>
            <p className="insight-compact__muted">
              {t('ocrFound', { count: result.regions.length })}
              {' '}
              {t('ocrBlurHint')}
            </p>
            <div className="ocr-text-block">
              <pre className={`ocr-text-content ${expanded ? 'ocr-text-content--expanded' : ''}`}>
                {result.fullText}
              </pre>
              {result.fullText.length > 200 && !expanded ? (
                <button
                  type="button"
                  className="button button--ghost ocr-expand-button"
                  onClick={() => setExpanded(true)}
                >
                  …
                </button>
              ) : null}
            </div>
          </>
        )
      ) : null}
    </section>
  );
};
