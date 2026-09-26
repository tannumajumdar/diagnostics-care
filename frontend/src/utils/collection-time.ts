/** `YYYY-MM-DDTHH:mm` in local time - the value a datetime-local input takes. */
export const toLocalInput = (d: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A datetime-local value as the ISO string the status endpoint expects. */
export const localInputToIso = (value: string) => (value ? new Date(value).toISOString() : undefined);

/** When the sample was drawn, or null if it has not been. */
export const collectedLabel = (s: any): string | null => {
  if (s?.collectionDate) {
    return new Date(s.collectionDate).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return s?.collectionTime || null;
};
