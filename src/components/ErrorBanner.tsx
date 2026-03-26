import React from 'react';
import { useT } from '../i18n';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry, onDismiss }) => {
  const t = useT();
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onRetry ? (
          <button type="button" className="button button--ghost" onClick={onRetry}>
            {t('retry')}
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" className="button button--ghost" onClick={onDismiss} aria-label="Dismiss">
            &times;
          </button>
        ) : null}
      </div>
    </div>
  );
};
