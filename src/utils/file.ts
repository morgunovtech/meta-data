export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const nextUnit of units) {
    value /= 1024;
    unit = nextUnit;
    if (value < 1024) break;
  }
  return `${value.toFixed(1)} ${unit}`;
};

export const formatMB = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);
