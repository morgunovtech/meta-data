import React from 'react';
import clsx from 'clsx';
import { useTheme, type ThemeMode } from '../theme';
import { useT, type MessageKey } from '../i18n';

const options: Array<{ mode: ThemeMode; iconKey: MessageKey; labelKey: MessageKey }> = [
  { mode: 'light', iconKey: 'themeLightIcon', labelKey: 'themeLightLabel' },
  { mode: 'dark', iconKey: 'themeDarkIcon', labelKey: 'themeDarkLabel' },
  { mode: 'system', iconKey: 'themeSystemIcon', labelKey: 'themeSystemLabel' }
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
          title={t(option.labelKey)}
        >
          <span aria-hidden="true">{t(option.iconKey)}</span>
        </button>
      ))}
    </div>
  );
};
