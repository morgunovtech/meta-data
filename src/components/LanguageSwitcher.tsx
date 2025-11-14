import React from 'react';
import clsx from 'clsx';
import { useI18n, useT } from '../i18n';

const languages: { code: 'ru' | 'en' | 'uz'; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'uz', label: 'UZ' }
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
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
};
