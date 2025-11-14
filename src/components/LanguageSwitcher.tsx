import React from 'react';
import clsx from 'clsx';
import { useI18n, useT } from '../i18n';

const languages: Array<{ code: 'ru' | 'en' | 'uz'; flag: string; labelKey: 'languageRu' | 'languageEn' | 'languageUz' }> = [
  { code: 'ru', flag: '🇷🇺', labelKey: 'languageRu' },
  { code: 'en', flag: '🇺🇸', labelKey: 'languageEn' },
  { code: 'uz', flag: '🇺🇿', labelKey: 'languageUz' }
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
          aria-label={t(entry.labelKey)}
          title={t(entry.labelKey)}
        >
          {entry.flag}
        </button>
      ))}
    </div>
  );
};
