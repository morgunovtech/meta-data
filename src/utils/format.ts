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

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

