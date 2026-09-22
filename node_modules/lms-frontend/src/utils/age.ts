/**
 * Age, in the two shapes the centre actually uses.
 *
 * The desk types a date of birth and expects the age to fill itself in; the
 * bill and the report print the older `55 Y 0 M 0 D/MALE` form the counter has
 * always read. Both come off the same date so the two can never disagree.
 */

/** Whole years between a date of birth and today, or null if unusable. */
export const yearsSince = (dob?: string | Date | null): number | null => {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  // A date in the future is a typo, not a newborn.
  if (born > today) return null;

  let years = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) years -= 1;

  return Math.max(0, years);
};

/** Years, months and days between a date of birth and today. */
export const ageBreakdown = (dob?: string | Date | null): { years: number; months: number; days: number } | null => {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  if (born > today) return null;

  let years = today.getFullYear() - born.getFullYear();
  let months = today.getMonth() - born.getMonth();
  let days = today.getDate() - born.getDate();

  if (days < 0) {
    months -= 1;
    // Day 0 of this month is the last day of the previous one.
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years: Math.max(0, years), months, days };
};

/**
 * `55 Y/MALE` for the bill and the report - the age, not a running count of
 * months and days nobody reads. The one place the smaller units matter is a
 * baby: under a year the age is spoken in months, and in the first month in
 * days, because "0 Y" tells the bench nothing about a neonate.
 */
export const ageSexLabel = (patient: { age?: number | string; gender?: string; dateOfBirth?: string | Date }): string => {
  const sex = String(patient?.gender || '').toUpperCase() || '-';
  const exact = ageBreakdown(patient?.dateOfBirth);

  if (exact) {
    if (exact.years > 0) return `${exact.years} Y/${sex}`;
    if (exact.months > 0) return `${exact.months} M/${sex}`;
    return `${exact.days} D/${sex}`;
  }

  return `${patient?.age ?? '-'} Y/${sex}`;
};

/**
 * The age as the bench needs to read it, in the unit that carries meaning at
 * that stage of life: a newborn is counted in days, an infant in months, and
 * everyone past their second birthday in whole years. "0 years" is the one
 * answer that helps nobody - a seven-day-old and a seven-month-old need
 * different reference ranges, and the desk has to see which one is standing
 * in front of it.
 *
 * Falls back to the plain years the desk typed when no date of birth is on
 * file, because that is all the record knows.
 */
export const ageLabel = (patient: { age?: number | string; dateOfBirth?: string | Date | null }): string => {
  const exact = ageBreakdown(patient?.dateOfBirth);

  if (exact) {
    const { years, months, days } = exact;
    // Past two, the months and days are noise on a bill nobody reads them off.
    if (years >= 2) return `${years} years`;
    if (years === 1) return months > 0 ? `1 year ${months} months` : '1 year';
    if (months > 0) return days > 0 ? `${months} months ${days} days` : `${months} months`;
    return days === 1 ? '1 day' : `${days} days`;
  }

  const years = Number(patient?.age);
  if (!Number.isFinite(years)) return '-';
  return years === 1 ? '1 year' : `${years} years`;
};

/** Whole days lived, or null when there is no usable date of birth. */
export const daysSince = (dob?: string | Date | null): number | null => {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  if (born > today) return null;

  // Both ends as bare dates in UTC, so a clock change in between cannot add or
  // drop a day.
  const bornDay = Date.UTC(born.getFullYear(), born.getMonth(), born.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.max(0, Math.round((todayDay - bornDay) / 86400000));
};

/**
 * The age as a running count of days - `1642 days`, not `5 years 5 months`.
 *
 * A year is 365 days on this counter and a child born between two birthdays
 * lands on the day in between, which is the number the desk wants to read back
 * off the form it just filled. The whole years still go to the server; this is
 * only what the box shows.
 */
export const ageDaysLabel = (patient: { dateOfBirth?: string | Date | null }): string => {
  const days = daysSince(patient?.dateOfBirth);
  if (days === null) return '-';
  return days === 1 ? '1 day' : `${days} days`;
};

/**
 * `21 Y 8 M 30 D` - the same date read out in calendar units. The running day
 * count is exact but says nothing at a glance, so the form prints both: the
 * years tell the desk who is standing there, the days settle two children born
 * months apart.
 */
export const ageYmdLabel = (patient: { dateOfBirth?: string | Date | null }): string => {
  const exact = ageBreakdown(patient?.dateOfBirth);
  if (!exact) return '-';
  return `${exact.years} Y ${exact.months} M ${exact.days} D`;
};
