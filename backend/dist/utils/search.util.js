"use strict";
/**
 * Searching the test master the way the desk types.
 *
 * A counter hand does not type "Activated Partial Thromboplastin Time" - it
 * types APTT, or LFT, or Hb. Some of those abbreviations sit in the test name
 * already, in brackets, and a plain substring finds those. The rest are the
 * initials of the words, or the short name of a parameter inside the test, and
 * those needed asking for by hand.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSearchClauses = exports.escapeRegex = void 0;
/** Takes the regex meaning out of whatever was typed - "C-Reactive (CRP)" is a name, not a pattern. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
exports.escapeRegex = escapeRegex;
/** A query that could be an abbreviation: a short run of letters, no spaces. */
const looksLikeAbbreviation = (q) => /^[a-z]{2,6}$/i.test(q);
/**
 * `CBC` as the initials of consecutive words - matches "Complete Blood Count"
 * wherever it starts, so "Complete Blood Count (CBC)" and "Absolute Eosinophil
 * Count" both answer to their own letters.
 */
const initialsRegex = (q) => new RegExp('\\b' +
    q
        .split('')
        .map((ch) => `${(0, exports.escapeRegex)(ch)}[a-z]*`)
        .join('[\\s-]+'), 'i');
/**
 * The `$or` clauses a test search should run: the name and the code as typed,
 * the short name and the name of any parameter on the test, and - when the
 * query reads like an abbreviation - the initials of the test's words.
 */
const testSearchClauses = (search) => {
    const q = search.trim();
    if (!q)
        return [];
    const like = { $regex: (0, exports.escapeRegex)(q), $options: 'i' };
    const clauses = [
        { testName: like },
        { testCode: like },
        { 'parameters.shortName': like },
        { 'parameters.parameterName': like },
    ];
    if (looksLikeAbbreviation(q))
        clauses.push({ testName: { $regex: initialsRegex(q) } });
    return clauses;
};
exports.testSearchClauses = testSearchClauses;
