import React, { useState } from 'react';
import type { DigitalProfile } from '../utils/heuristics/digitalProfile';
import { generateReport } from '../utils/heuristics/digitalProfile';
import type { StructuredMetadata, BasicFileInfo } from '../types/metadata';
import type { BoundingBox } from '../types/detection';
import type { OCRResult } from '../hooks/useOCR';
import type { ProData } from '../App';

interface ProfileBlockProps {
  profile: DigitalProfile | null;
  lang: 'ru' | 'en' | 'uz';
  metadata: StructuredMetadata | null;
  proData: ProData | null;
  fileInfo: BasicFileInfo | null;
  detections: BoundingBox[];
  ocrResult: OCRResult | null;
}

type Row = [string, string];

function formatValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

function flattenEntries(obj: Record<string, unknown>, prefix = ''): Row[] {
  const rows: Row[] = [];
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

function buildProGroups(
  profile: DigitalProfile,
  metadata: StructuredMetadata | null,
  proData: ProData | null,
  fileInfo: BasicFileInfo | null,
  detections: BoundingBox[],
  ocrResult: OCRResult | null,
  lang: string
): Array<{ group: string; rows: Row[] }> {
  const groups: Array<{ group: string; rows: Row[] }> = [];

  // 1. Leak score + profile sections
  const profileRows: Row[] = [
    ['Leak Score', `${profile.leakScore}/100 (${profile.leakLevel.label})`],
    ...profile.sections.map(s => [
      `${s.icon} ${s.title}`,
      `${s.text}${s.subtext ? ` — ${s.subtext}` : ''}${s.threatScenario ? ` [${s.threatScenario}]` : ''}`,
    ] as Row),
  ];
  groups.push({ group: lang === 'ru' ? 'Профиль' : 'Profile', rows: profileRows });

  // 2. File info
  if (fileInfo) {
    const fileRows: Row[] = [
      ['filename', fileInfo.originalName ?? fileInfo.file.name],
      ['mimeType', fileInfo.mimeType],
      ['size', `${(fileInfo.sizeBytes / 1024).toFixed(1)} KB`],
      ['dimensions', `${fileInfo.width} x ${fileInfo.height}`],
      ['aspectRatio', fileInfo.aspectRatio.toFixed(3)],
      ['megapixels', ((fileInfo.width * fileInfo.height) / 1_000_000).toFixed(1)],
    ];
    if (fileInfo.wasConverted) {
      fileRows.push(['originalMimeType', fileInfo.originalMimeType ?? '']);
      if (fileInfo.originalSizeBytes) fileRows.push(['originalSize', `${(fileInfo.originalSizeBytes / 1024).toFixed(1)} KB`]);
    }
    groups.push({ group: lang === 'ru' ? 'Файл' : 'File', rows: fileRows });
  }

  // 3. Filename heuristics
  if (proData?.filename) {
    const fn = proData.filename;
    const rows: Row[] = [
      ['platform', fn.platform ?? '—'],
      ['device', fn.device || '—'],
      ['confidence', fn.confidence > 0 ? `${(fn.confidence * 100).toFixed(0)}%` : '—'],
    ];
    if (fn.photoIndex != null) rows.push(['photoIndex', String(fn.photoIndex)]);
    if (fn.estimatedMonths != null) rows.push(['estimatedMonthsOfUse', String(fn.estimatedMonths)]);
    groups.push({ group: lang === 'ru' ? 'Эвристика: имя файла' : 'Heuristic: filename', rows });
  }

  // 4. Resolution heuristics
  if (proData?.resolution) {
    const res = proData.resolution;
    const rows: Row[] = [
      ['possibleDevices', res.possibleDevices.length > 0 ? res.possibleDevices.join(', ') : '—'],
      ['contentType', res.contentType],
      ['contentHint', res.contentHint || '—'],
      ['isScreenshot', String(res.isScreenshot)],
    ];
    groups.push({ group: lang === 'ru' ? 'Эвристика: разрешение' : 'Heuristic: resolution', rows });
  }

  // 5. Stripped detection
  if (proData?.stripped) {
    const st = proData.stripped;
    const rows: Row[] = [
      ['stripped', String(st.stripped)],
      ['strippedBy', st.strippedBy ?? '—'],
      ['confidence', st.confidence > 0 ? `${(st.confidence * 100).toFixed(0)}%` : '—'],
    ];
    for (let i = 0; i < st.evidence.length; i++) {
      rows.push([`evidence[${i}]`, st.evidence[i]]);
    }
    groups.push({ group: lang === 'ru' ? 'Эвристика: стрипнутые метаданные' : 'Heuristic: stripped metadata', rows });
  }

  // 6. Editing history
  if (proData?.editing) {
    const ed = proData.editing;
    const rows: Row[] = [
      ['edited', String(ed.edited)],
      ['editingLevel', ed.editingLevel],
      ['software', ed.software.length > 0 ? ed.software.join(', ') : '—'],
      ['isAiGenerated', String(ed.isAiGenerated)],
      ['aiTool', ed.aiTool ?? '—'],
    ];
    for (let i = 0; i < ed.hints.length; i++) {
      rows.push([`hint[${i}]`, ed.hints[i]]);
    }
    groups.push({ group: lang === 'ru' ? 'Эвристика: редактирование' : 'Heuristic: editing', rows });
  }

  // 7. Temporal analysis
  if (proData?.temporal && proData.temporal.length > 0) {
    const rows: Row[] = proData.temporal.map((t, i) => [`[${i}] ${t.severity}`, `${t.fact}${t.inference ? ` — ${t.inference}` : ''}`]);
    groups.push({ group: lang === 'ru' ? 'Эвристика: время' : 'Heuristic: temporal', rows });
  }

  // 8. Hash
  if (proData?.hash) {
    groups.push({ group: 'SHA-256', rows: [['sha256', proData.hash.sha256]] });
  }

  // 9. Serial numbers
  if (profile.serialNumbers.length > 0) {
    groups.push({
      group: lang === 'ru' ? 'Серийные номера' : 'Serial Numbers',
      rows: profile.serialNumbers.map(s => {
        const idx = s.indexOf(': ');
        return idx >= 0 ? [s.slice(0, idx), s.slice(idx + 2)] : [s, ''];
      }),
    });
  }

  // 10. Object detections
  if (detections.length > 0) {
    const rows: Row[] = detections.map((d, i) => [
      `[${i}] ${d.label}`,
      `score=${d.score.toFixed(2)} x=${Math.round(d.x)} y=${Math.round(d.y)} w=${Math.round(d.width)} h=${Math.round(d.height)}`,
    ]);
    groups.push({ group: lang === 'ru' ? 'Детекции объектов' : 'Object detections', rows });
  }

  // 11. OCR
  if (ocrResult) {
    const rows: Row[] = [
      ['regions', String(ocrResult.regions.length)],
      ['fullText', ocrResult.fullText.length > 500 ? ocrResult.fullText.slice(0, 500) + '...' : ocrResult.fullText],
    ];
    groups.push({ group: 'OCR', rows });
  }

  // 12. Structured metadata fields
  if (metadata) {
    const structured: Row[] = [];
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
      if (metadata.gps.accuracy != null) structured.push(['gps.accuracy', `\u00b1${metadata.gps.accuracy}m`]);
      if (metadata.gps.heading != null) structured.push(['gps.heading', `${metadata.gps.heading}\u00b0`]);
    }
    structured.push(['completeness', `${metadata.completeness}/100`]);
    if (metadata.orientation) structured.push(['orientation', metadata.orientation]);
    if (structured.length > 0) {
      groups.push({ group: lang === 'ru' ? 'Структурированные поля' : 'Structured Fields', rows: structured });
    }
  }

  // 13-16. Raw EXIF, XMP, IPTC, ICC
  if (metadata) {
    for (const [groupName, groupData] of Object.entries(metadata.groups)) {
      const data = groupData as Record<string, unknown>;
      if (!data || Object.keys(data).length === 0) continue;
      const entries = flattenEntries(data);
      if (entries.length > 0) {
        groups.push({ group: `Raw ${groupName.toUpperCase()}`, rows: entries });
      }
    }
  }

  return groups;
}

export const ProfileBlock: React.FC<ProfileBlockProps> = ({ profile, lang, metadata, proData, fileInfo, detections, ocrResult }) => {
  const [copied, setCopied] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [proMode, setProMode] = useState(false);

  if (!profile || profile.sections.length === 0) return null;

  const handleCopy = () => {
    const report = generateReport(profile, lang);
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API denied (iframe, permissions policy) — fallback to text selection
      console.warn('clipboard-write-denied');
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
  const proGroups = proMode ? buildProGroups(profile, metadata, proData, fileInfo, detections, ocrResult, lang) : [];

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

      {proMode ? (
        <div className="pro-table-container">
          {proGroups.map((group, gi) => (
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
          <div className="profile-score">
            <div className="profile-score__bar">
              <div
                className="profile-score__fill"
                style={{ width: `${scorePercent}%`, backgroundColor: profile.leakLevel.color }}
              />
            </div>
            <div className="profile-score__label" style={{ color: profile.leakLevel.color }}>
              <strong>{profile.leakScore}/100</strong>
              <span> — {profile.leakLevel.label}</span>
            </div>
            <p className="profile-score__desc">{profile.leakLevel.description}</p>
          </div>

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
                  <div className="profile-section__threat">{section.threatScenario}</div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

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
