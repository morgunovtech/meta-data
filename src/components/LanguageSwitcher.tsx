import React from 'react';
import clsx from 'clsx';
import { useI18n, useT } from '../i18n';

const languages: { code: 'ru' | 'en' | 'uz'; flag: string; label: string }[] = [
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'uz', flag: '🇺🇿', label: 'Oʻzbekcha' }
];

export const LanguageSwitcher: React.FC = () => {
  const { lang, setLanguage } = useI18n();
  const t = useT();
  return (
    <div className="segmented-control" role="group" aria-label={t('language')}>
      {languages.map((entry) => (
        <button
          type="button"
          key={entry.code}
          className={clsx({ active: lang === entry.code })}
          onClick={() => setLanguage(entry.code)}
          aria-label={entry.label}
        >
          <span aria-hidden="true">{entry.flag}</span>
          <span className="sr-only">{entry.label}</span>
        </button>
      ))}
    </div>
  );
};
