import React, { createContext, useContext, useMemo, useState } from 'react';
import { messages, type LanguageKey } from './messages';

interface LanguageContextState {
  language: LanguageKey;
  setLanguage: (lang: LanguageKey) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextState | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<LanguageKey>('ru');

  const translate = (key: string, params?: Record<string, string | number>) => {
    const dict = messages[language];
    let value = dict[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([token, tokenValue]) => {
        value = value.replace(`{${token}}`, String(tokenValue));
      });
    }
    return value;
  };

  const value = useMemo(
    () => ({ language, setLanguage, t: translate }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextState => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
