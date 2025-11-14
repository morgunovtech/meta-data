import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  tone: 'error' | 'info';
  messageKey: string;
  messageParams?: Record<string, string | number>;
  onRetry?: () => void;
  retryKey?: string;
}

const NotificationBanner: React.FC<Props> = ({ tone, messageKey, messageParams, onRetry, retryKey }) => {
  const { t } = useLanguage();
  const background = tone === 'error' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(56, 189, 248, 0.1)';
  const border = tone === 'error' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(56, 189, 248, 0.4)';

  return (
    <div className="panel" style={{ background, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <p style={{ margin: 0 }}>{t(messageKey, messageParams)}</p>
        {onRetry && (
          <button className="button-secondary" onClick={onRetry} type="button">
            {t(retryKey ?? 'notification_retry')}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationBanner;
