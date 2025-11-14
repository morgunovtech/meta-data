import React from 'react';
import { useI18n } from '../i18n';

const languages: { code: 'ru' | 'en' | 'uz'; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'uz', label: 'UZ' }
];

export const LanguageSwitcher: React.FC = () => {
  const { lang, setLanguage } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Language selector">
      {languages.map((entry) => (
        <button
          type="button"
          key={entry.code}
          className={lang === entry.code ? 'active' : ''}
          onClick={() => setLanguage(entry.code)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
};
