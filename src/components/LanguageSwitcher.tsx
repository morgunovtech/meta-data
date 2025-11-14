import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { Locale } from '../i18n/messages';

const locales: Locale[] = ['ru', 'en', 'uz'];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switcher" aria-label={t('languageLabel')}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={code === locale ? 'active' : ''}
          aria-pressed={code === locale}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
