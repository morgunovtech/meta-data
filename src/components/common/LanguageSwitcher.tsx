import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { LanguageKey } from '../../i18n/messages';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const languages: LanguageKey[] = ['ru', 'en', 'uz'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
      <label style={{ fontSize: 12, opacity: 0.7 }}>{t('language_switcher_label')}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {languages.map((lang) => (
          <button
            key={lang}
            className="button-secondary"
            style={{
              padding: '0.35rem 0.75rem',
              borderColor: lang === language ? 'var(--accent)' : 'rgba(148, 163, 184, 0.4)',
              color: lang === language ? 'var(--accent)' : 'inherit'
            }}
            onClick={() => setLanguage(lang)}
            type="button"
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
