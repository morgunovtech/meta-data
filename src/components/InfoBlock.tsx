import React from 'react';
import { useT } from '../i18n';

export const InfoBlock: React.FC = () => {
  const t = useT();
  return (
    <section className="panel panel--intro">
      <h1 className="section-title">{t('appTitle')}</h1>
      <div className="panel__copy">
        <p>{t('introLead')}</p>
        <p>{t('introHow')}</p>
        <p>{t('introSafe')}</p>
      </div>
    </section>
  );
};
