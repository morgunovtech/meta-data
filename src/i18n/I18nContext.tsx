import React, { createContext, useContext, useMemo, useState } from 'react';
import { Locale, messages } from './messages';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>('ru');

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => {
        const dictionary = messages[locale];
        let template = dictionary[key] ?? key;
        if (params) {
          Object.entries(params).forEach(([paramKey, paramValue]) => {
            template = template.replace(`{${paramKey}}`, String(paramValue));
          });
        }
        return template;
      }
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
