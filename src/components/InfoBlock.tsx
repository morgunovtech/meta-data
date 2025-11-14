import React from 'react';
import { useT } from '../i18n';

export const InfoBlock: React.FC = () => {
  const t = useT();
  return (
    <section className="panel">
      <h1 className="section-title">{t('appTitle')}</h1>
      <p>{t('introLead')}</p>
      <p>{t('introHow')}</p>
      <p>{t('introSafe')}</p>
      <div className="controls-row" style={{ marginTop: '0.75rem' }}>
        <a href="#" rel="noreferrer">
          {t('privacyPolicy')}
        </a>
        <a href="https://github.com/" rel="noreferrer">
          {t('sourceCode')}
        </a>
      </div>
    </section>
  );
};
