export function formatDate(value?: string, locale: string = 'ru-RU'): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function toIsoDate(date?: string): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}
