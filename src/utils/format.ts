import type { DetectionSummary } from '../types/detection';
import type { MessageKey } from '../i18n';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

export function formatMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return mp.toFixed(2);
}

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height}`;
}

export function formatNumber(value?: number, fractionDigits = 1): string | undefined {
  if (value == null) return undefined;
  return value.toFixed(fractionDigits);
}

export function formatExactBytes(bytes: number): string {
  return new Intl.NumberFormat(undefined).format(bytes);
}

export function formatLocalizedDateTime(value: string | Date | undefined, locale: string): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

const MIME_FORMATS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP'
};

type FileTypeKey = 'fileTypeImage' | 'fileTypeUnknown';

export function describeFileType(mime: string, fileName?: string): { typeKey: FileTypeKey; format: string } {
  const normalized = mime.toLowerCase();
  const typeKey: FileTypeKey = normalized.startsWith('image/') ? 'fileTypeImage' : 'fileTypeUnknown';
  const extension = fileName?.split('.').pop();
  const fallback = extension ? extension.toUpperCase() : mime.split('/')[1]?.toUpperCase() ?? mime;
  const format = MIME_FORMATS[normalized] ?? fallback;
  return { typeKey, format };
}

export function formatSceneCounts(
  summary: DetectionSummary,
  locale: string,
  dict: Record<string, string>,
  t: (key: MessageKey, values?: Record<string, unknown>) => string
): string[] {
  const rules = new Intl.PluralRules(locale);
  const segments: string[] = [];

  const addSegment = (count: number, baseKey: string) => {
    if (count <= 0) return;
    const category = rules.select(count);
    const candidateKey = `${baseKey}_${category}` as MessageKey;
    const fallbackKey = `${baseKey}_other` as MessageKey;
    const key = (candidateKey in dict ? candidateKey : fallbackKey) as MessageKey;
    segments.push(t(key, { count }));
  };

  addSegment(summary.people, 'sceneLabelPeople');
  addSegment(summary.faces, 'sceneLabelFaces');
  addSegment(summary.vehicles, 'sceneLabelVehicles');
  addSegment(summary.animals, 'sceneLabelAnimals');

  return segments;
}
