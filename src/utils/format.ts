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

export function formatDate(value?: string | Date): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatDetailedDate(value: string | Date | undefined, locale?: string, timeZone?: string): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const format = (resolvedTimeZone?: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: resolvedTimeZone
    }).format(date);
  try {
    return capitalizeFirstLetter(format(timeZone));
  } catch (error) {
    return capitalizeFirstLetter(format(undefined));
  }
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatAccuracy(value?: number): string | undefined {
  if (value == null) return undefined;
  return `${Math.round(value)} m`;
}

export function formatMeters(value: number, locale?: string): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'meter',
      unitDisplay: 'narrow',
      maximumFractionDigits: value < 100 ? 1 : 0
    }).format(value);
  } catch (error) {
    return `${Math.round(value)} m`;
  }
}

export function formatNumber(value?: number, fractionDigits = 1): string | undefined {
  if (value == null) return undefined;
  return value.toFixed(fractionDigits);
}

export function formatExactBytes(bytes: number): string {
  return new Intl.NumberFormat(undefined).format(bytes);
}

function capitalizeFirstLetter(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
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
