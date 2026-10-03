/**
 * The age as a report reads it - the server's copy of frontend/src/utils/age.ts.
 *
 * A newborn is counted in days, an infant in months, everyone past their
 * second birthday in whole years: "0 Yrs" helps nobody, and a seven-day-old
 * and a seven-month-old read different reference ranges. Falls back to the
 * years the desk typed when there is no date of birth on file.
 */
export const ageLabel = (patient: { age?: unknown; dateOfBirth?: string | Date | null } | null | undefined): string => {
  const born = patient?.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const today = new Date();

  if (born && !Number.isNaN(born.getTime()) && born <= today) {
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
    years = Math.max(0, years);

    if (years >= 2) return `${years} Yrs`;
    if (years === 1) return months > 0 ? `1 Yr ${months} Mths` : '1 Yr';
    if (months > 0) return days > 0 ? `${months} Mths ${days} Days` : `${months} Mths`;
    return days === 1 ? '1 Day' : `${days} Days`;
  }

  const years = Number(patient?.age);
  if (patient?.age === undefined || patient?.age === null || patient?.age === '' || !Number.isFinite(years)) return '-';
  return `${years} Yrs`;
};
