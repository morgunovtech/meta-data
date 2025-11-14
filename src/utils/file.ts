export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const isSupportedType = (type: string) => {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type);
};

export const formatFileSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
};

export const getMegapixels = (width: number, height: number) => {
  return Number((width * height / 1_000_000).toFixed(2));
};
