import React from 'react';
import { useT } from '../i18n';

export const InfoBlock: React.FC = () => {
  const t = useT();
  return (
    <section className="panel info-panel">
      <h1 className="section-title">{t('appTitle')}</h1>
      <p className="info-panel__lead">{t('introLead')}</p>
      <ul className="info-panel__list">
        <li>{t('introHow')}</li>
        <li>{t('introSafe')}</li>
      </ul>
    </section>
  );
};
