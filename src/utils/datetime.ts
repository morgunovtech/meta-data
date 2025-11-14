export const formatLocalDateTime = (isoString: string, timeZone?: string): string => {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone
    }).format(date);
  } catch (error) {
    return isoString;
  }
};

export const toIsoOrNull = (input?: string): string | null => {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
