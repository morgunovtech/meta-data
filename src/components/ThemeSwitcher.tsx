import React from 'react';
import clsx from 'clsx';
import { useTheme, type ThemeMode } from '../theme';
import { useT, type MessageKey } from '../i18n';

const options: Array<{ mode: ThemeMode; icon: string; labelKey: MessageKey }> = [
  { mode: 'light', icon: '☀️', labelKey: 'themeLight' },
  { mode: 'dark', icon: '🌙', labelKey: 'themeDark' },
  { mode: 'accessible', icon: '🟡', labelKey: 'themeAccessible' },
  { mode: 'system', icon: '🌓', labelKey: 'themeSystem' }
];

export const ThemeSwitcher: React.FC = () => {
  const { mode, setMode } = useTheme();
  const t = useT();
  return (
    <div className="segmented-control" role="group" aria-label={t('themeLabel')}>
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={clsx({ active: mode === option.mode })}
          onClick={() => setMode(option.mode)}
          aria-label={t(option.labelKey)}
          aria-pressed={mode === option.mode}
        >
          <span aria-hidden="true">{option.icon}</span>
          <span className="sr-only">{t(option.labelKey)}</span>
        </button>
      ))}
    </div>
  );
};
