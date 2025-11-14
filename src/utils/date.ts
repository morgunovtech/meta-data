export const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleString();
  } catch (error) {
    return undefined;
  }
};

export const toIsoIfPossible = (value?: string) => {
  if (!value) return undefined;
  const isoCandidate = new Date(value);
  if (Number.isNaN(isoCandidate.getTime())) return undefined;
  return isoCandidate.toISOString();
};
