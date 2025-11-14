import React from 'react';
import { useI18n } from '@/i18n/I18nContext';
import type { SupportedLocale } from '@/i18n/messages';

const locales: SupportedLocale[] = ['ru', 'en', 'uz'];

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t('language_label')}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? 'active' : ''}
          onClick={() => setLocale(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
