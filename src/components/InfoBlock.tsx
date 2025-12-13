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
        <li>{t('introFeatureCleanup')}</li>
        <li>{t('introFeatureOcr')}</li>
      </ul>
      <div className="info-panel__jobs">
        <h2 className="section-title section-title--small">{t('introJobsTitle')}</h2>
        <ul className="info-panel__list info-panel__list--compact">
          <li>{t('introJobPrivacy')}</li>
          <li>{t('introJobMasking')}</li>
          <li>{t('introJobProof')}</li>
          <li>{t('introJobPresets')}</li>
        </ul>
      </div>
    </section>
  );
};
