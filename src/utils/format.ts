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

export function formatLocalizedDateTime(
  value: string | Date | undefined,
  lang: string,
  timeZone?: string
): { formatted: string; weekday: string } | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat(lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone
  });
  const formatted = formatter.format(date);
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone }).format(date);
  return { formatted: capitalizeFirst(formatted), weekday: capitalizeFirst(weekday) };
}

export function formatCoordinatePair(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
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
