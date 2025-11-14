import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export const InfoBlock: React.FC = () => {
  const { t } = useI18n();
  return (
    <header className="info-block">
      <div>
        <h1>{t('appTitle')}</h1>
        <p>{t('appSubtitle')}</p>
        <p>{t('howToUse')}</p>
        <nav>
          <a href="#">{t('privacyPolicy')}</a>
          <a href="#">{t('sourceCode')}</a>
        </nav>
      </div>
      <LanguageSwitcher />
    </header>
  );
};
