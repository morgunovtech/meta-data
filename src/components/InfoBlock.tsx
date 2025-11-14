import React from 'react';
import { useI18n } from '@/i18n/I18nContext';

export const InfoBlock: React.FC = () => {
  const { t } = useI18n();
  return (
    <header className="info-block">
      <h1>{t('app_title')}</h1>
      <p>{t('hero_intro')}</p>
      <p>{t('hero_usage')}</p>
      <p>{t('hero_safety')}</p>
      <nav>
        <a href="#">{t('privacy_policy')}</a>
        <a href="#">{t('source_code')}</a>
      </nav>
    </header>
  );
};
