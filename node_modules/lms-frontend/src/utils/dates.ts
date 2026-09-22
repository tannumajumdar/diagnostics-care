/**
 * Dates as the front desk says them.
 *
 * Every date filter in the app is a local calendar day - "today's billing" is
 * the day the receptionist is standing in, not a UTC window. `toISOString()`
 * would push an evening bill into tomorrow for any lab east of Greenwich, so
 * day keys are always built from the local parts.
 */

/** `YYYY-MM-DD` for a date, in the browser's own calendar. */
export const dayKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const todayKey = (): string => dayKey();

/** `YYYY-MM-DD` for n days ago - 0 is today, 6 is the start of a seven-day week. */
export const daysAgoKey = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dayKey(date);
};

/** First day of the month the given date falls in. */
export const startOfMonthKey = (date: Date = new Date()): string =>
  dayKey(new Date(date.getFullYear(), date.getMonth(), 1));

/** "9 Sep 2026" - what a date filter or a report row shows. */
export const formatDay = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "9 Sep 2026, 4:12 pm" - for a row where the time of day matters. */
export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDay(date)}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

/** "Today" / "Yesterday" where that reads better than the date itself. */
export const relativeDayLabel = (key: string): string => {
  if (key === todayKey()) return 'Today';
  if (key === daysAgoKey(1)) return 'Yesterday';
  return formatDay(`${key}T00:00:00`);
};

/** "Mon" - the weekday behind a `YYYY-MM-DD` key. */
export const weekdayLabel = (key: string): string => {
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { weekday: 'short' });
};

/** The ranges a desk actually asks for, as `{ from, to }` day keys. */
export const DATE_PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'Today', range: () => ({ from: todayKey(), to: todayKey() }) },
  { label: 'Yesterday', range: () => ({ from: daysAgoKey(1), to: daysAgoKey(1) }) },
  { label: 'Last 7 days', range: () => ({ from: daysAgoKey(6), to: todayKey() }) },
  { label: 'Last 30 days', range: () => ({ from: daysAgoKey(29), to: todayKey() }) },
  { label: 'This month', range: () => ({ from: startOfMonthKey(), to: todayKey() }) },
];
