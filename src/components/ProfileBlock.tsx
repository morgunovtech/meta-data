import React, { useState } from 'react';
import { useT } from '../i18n';
import type { DigitalProfile } from '../utils/heuristics/digitalProfile';
import { generateReport } from '../utils/heuristics/digitalProfile';

interface ProfileBlockProps {
  profile: DigitalProfile | null;
  lang: 'ru' | 'en' | 'uz';
}

export const ProfileBlock: React.FC<ProfileBlockProps> = ({ profile, lang }) => {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!profile || profile.sections.length === 0) return null;

  const handleCopy = () => {
    const report = generateReport(profile, lang);
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const report = generateReport(profile, lang);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'foundyou-report.txt';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 1000);
  };

  const scorePercent = Math.min(100, Math.max(0, profile.leakScore));

  return (
    <section className="panel profile-panel">
      <h3>{lang === 'ru' ? 'Цифровой профиль' : lang === 'uz' ? 'Raqamli profil' : 'Digital Profile'}</h3>

      {/* Leak score bar */}
      <div className="profile-score">
        <div className="profile-score__bar">
          <div
            className="profile-score__fill"
            style={{
              width: `${scorePercent}%`,
              backgroundColor: profile.leakLevel.color,
            }}
          />
        </div>
        <div className="profile-score__label" style={{ color: profile.leakLevel.color }}>
          <strong>{profile.leakScore}/100</strong>
          <span> — {profile.leakLevel.label}</span>
        </div>
        <p className="profile-score__desc">{profile.leakLevel.description}</p>
      </div>

      {/* Sections */}
      <div className="profile-sections">
        {profile.sections.map((section, idx) => (
          <div
            key={idx}
            className={`profile-section profile-section--${section.severity}`}
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <div className="profile-section__header">
              <span className="profile-section__icon">{section.icon}</span>
              <span className="profile-section__title">{section.title}</span>
              {section.leakPoints > 0 ? (
                <span className="profile-section__points">+{section.leakPoints}</span>
              ) : null}
            </div>
            <div className="profile-section__text">{section.text}</div>
            {section.subtext ? (
              <div className="profile-section__subtext">{section.subtext}</div>
            ) : null}
            {expandedIdx === idx && section.threatScenario ? (
              <div className="profile-section__threat">
                ⚠ {section.threatScenario}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="profile-export">
        <button type="button" className="button button--ghost" onClick={handleCopy}>
          {copied
            ? (lang === 'ru' ? 'Скопировано!' : 'Copied!')
            : (lang === 'ru' ? 'Скопировать отчёт' : lang === 'uz' ? 'Hisobotni nusxalash' : 'Copy report')}
        </button>
        <button type="button" className="button button--ghost" onClick={handleDownload}>
          {lang === 'ru' ? 'Скачать .txt' : lang === 'uz' ? '.txt yuklab olish' : 'Download .txt'}
        </button>
      </div>
    </section>
  );
};
