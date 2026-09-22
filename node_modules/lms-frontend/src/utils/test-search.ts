/**
 * Matching a test against what the desk typed.
 *
 * The same rules the server searches by, run over the tests already in memory
 * so a single letter is useful before the server is asked. The counter types
 * the abbreviation it has always said out loud - APTT, CBC, Hb - so the name,
 * the code, the parameters inside the test and the initials of the test's
 * words all count as a match.
 */

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A query that could be an abbreviation: a short run of letters, no spaces. */
const looksLikeAbbreviation = (q: string): boolean => /^[a-z]{2,6}$/i.test(q);

/** `CBC` as the initials of consecutive words - "Complete Blood Count". */
const initialsRegex = (q: string): RegExp =>
  new RegExp(
    '\\b' +
      q
        .split('')
        .map((ch) => `${escapeRegex(ch)}[a-z]*`)
        .join('[\\s-]+'),
    'i'
  );

type SearchableTest = {
  testName?: string;
  testCode?: string;
  parameters?: { parameterName?: string; shortName?: string }[];
};

export const matchesTestQuery = (test: SearchableTest, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const name = String(test?.testName || '');
  const haystack = [name, test?.testCode || '']
    .concat((test?.parameters || []).flatMap((p) => [p?.parameterName || '', p?.shortName || '']))
    .join(' ')
    .toLowerCase();

  if (haystack.includes(q)) return true;

  return looksLikeAbbreviation(q) && initialsRegex(q).test(name);
};
