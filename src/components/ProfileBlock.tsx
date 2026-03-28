import React, { useState } from 'react';
import type { DigitalProfile } from '../utils/heuristics/digitalProfile';
import { generateReport } from '../utils/heuristics/digitalProfile';
import type { StructuredMetadata } from '../types/metadata';

interface ProfileBlockProps {
  profile: DigitalProfile | null;
  lang: 'ru' | 'en' | 'uz';
  metadata: StructuredMetadata | null;
}

function formatValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function flattenEntries(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      rows.push(...flattenEntries(value as Record<string, unknown>, fullKey));
    } else {
      rows.push([fullKey, formatValue(value)]);
    }
  }
  return rows;
}

export const ProfileBlock: React.FC<ProfileBlockProps> = ({ profile, lang, metadata }) => {
  const [copied, setCopied] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [proMode, setProMode] = useState(false);

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

  // Build pro mode table data
  const proRows: Array<{ group: string; rows: Array<[string, string]> }> = [];
  if (proMode) {
    // Profile sections as table
    const profileRows: Array<[string, string]> = profile.sections.map(s => [
      `${s.icon} ${s.title}`,
      `${s.text}${s.subtext ? ` — ${s.subtext}` : ''}${s.threatScenario ? ` [${s.threatScenario}]` : ''}`,
    ]);
    profileRows.unshift([
      lang === 'ru' ? 'Leak Score' : 'Leak Score',
      `${profile.leakScore}/100 (${profile.leakLevel.label})`,
    ]);
    proRows.push({ group: lang === 'ru' ? 'Профиль' : 'Profile', rows: profileRows });

    // Serial numbers
    if (profile.serialNumbers.length > 0) {
      proRows.push({
        group: lang === 'ru' ? 'Серийные номера' : 'Serial Numbers',
        rows: profile.serialNumbers.map(s => {
          const [k, ...v] = s.split(': ');
          return [k, v.join(': ')];
        }),
      });
    }

    // Raw metadata groups
    if (metadata) {
      for (const [groupName, groupData] of Object.entries(metadata.groups)) {
        const data = groupData as Record<string, unknown>;
        if (!data || Object.keys(data).length === 0) continue;
        const entries = flattenEntries(data);
        if (entries.length > 0) {
          proRows.push({ group: groupName.toUpperCase(), rows: entries });
        }
      }

      // Structured fields
      const structured: Array<[string, string]> = [];
      if (metadata.shotDate) structured.push(['shotDate', metadata.shotDate]);
      if (metadata.cameraMake) structured.push(['cameraMake', metadata.cameraMake]);
      if (metadata.cameraModel) structured.push(['cameraModel', metadata.cameraModel]);
      if (metadata.lensModel) structured.push(['lensModel', metadata.lensModel]);
      if (metadata.software) structured.push(['software', metadata.software]);
      if (metadata.exposureTime) structured.push(['exposureTime', metadata.exposureTime]);
      if (metadata.aperture != null) structured.push(['aperture', `f/${metadata.aperture}`]);
      if (metadata.iso != null) structured.push(['iso', String(metadata.iso)]);
      if (metadata.focalLength != null) structured.push(['focalLength', `${metadata.focalLength}mm`]);
      if (metadata.focalLength35mm != null) structured.push(['focalLength35mm', `${metadata.focalLength35mm}mm`]);
      if (metadata.gps) {
        structured.push(['gps.lat', String(metadata.gps.lat)]);
        structured.push(['gps.lon', String(metadata.gps.lon)]);
        if (metadata.gps.altitude != null) structured.push(['gps.altitude', `${metadata.gps.altitude}m`]);
        if (metadata.gps.accuracy != null) structured.push(['gps.accuracy', `±${metadata.gps.accuracy}m`]);
        if (metadata.gps.heading != null) structured.push(['gps.heading', `${metadata.gps.heading}°`]);
      }
      structured.push(['completeness', `${metadata.completeness}/100`]);
      if (metadata.orientation) structured.push(['orientation', metadata.orientation]);
      if (structured.length > 0) {
        proRows.push({ group: lang === 'ru' ? 'Структурированные поля' : 'Structured Fields', rows: structured });
      }
    }
  }

  return (
    <section className="panel profile-panel">
      <div className="profile-header">
        <h3>{lang === 'ru' ? 'Цифровой профиль' : lang === 'uz' ? 'Raqamli profil' : 'Digital Profile'}</h3>
        <button
          type="button"
          className={`button button--ghost pro-mode-btn ${proMode ? 'pro-mode-btn--active' : ''}`}
          onClick={() => setProMode(!proMode)}
        >
          Pro
        </button>
      </div>

      {/* Pro mode: raw data table */}
      {proMode ? (
        <div className="pro-table-container">
          {proRows.map((group, gi) => (
            <div key={gi} className="pro-table-group">
              <div className="pro-table-group__title">{group.group}</div>
              <table className="pro-table">
                <tbody>
                  {group.rows.map(([key, value], ri) => (
                    <tr key={ri}>
                      <td className="pro-table__key">{key}</td>
                      <td className="pro-table__value">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <>
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
                    {section.threatScenario}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

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
