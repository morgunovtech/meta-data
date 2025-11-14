import React from 'react';
import clsx from 'clsx';
import { useTheme, type ThemeMode } from '../theme';
import { useT, type MessageKey } from '../i18n';

const options: Array<{ mode: ThemeMode; labelKey: MessageKey }> = [
  { mode: 'light', labelKey: 'themeLight' },
  { mode: 'dark', labelKey: 'themeDark' },
  { mode: 'system', labelKey: 'themeSystem' }
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
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
};
