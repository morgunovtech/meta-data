import React, { createContext, useContext, useMemo, useState } from 'react';
import { messages, SupportedLocale } from './messages';

type I18nContextValue = {
  locale: SupportedLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: SupportedLocale) => void;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const format = (template: string, params: Record<string, string | number> = {}) => {
  return template.replace(/\{(.*?)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
};

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocale] = useState<SupportedLocale>('ru');

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => {
        const dictionary = messages[locale];
        const template = dictionary[key] ?? key;
        return format(template, params);
      }
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
