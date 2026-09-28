/**
 * Diffs two parity recordings.
 *
 *   npx ts-node --transpile-only migration/parity/compare.ts mongo.json postgres.json
 *
 * `__v`, Mongoose's internal version counter, is dropped from both sides.
 *
 * Two things legitimately differ between runs and are masked before
 * comparing: ids minted during the run (an ObjectId's first eight hex digits
 * are its creation second, so anything newer than the run's start is new) and
 * timestamps taken during the run. Both are replaced by placeholders numbered
 * in order of first appearance, so "the invoice created in step 40 is the one
 * returned in step 41" is still checked - only the actual value is not.
 *
 * Exits non-zero when anything differs.
 */
import fs from 'fs';

const [aFile, bFile] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(aFile, 'utf8'));
const b = JSON.parse(fs.readFileSync(bFile, 'utf8'));

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const OID = /^[0-9a-f]{24}$/;
const JWT = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

function masker(startedAt: string) {
  const start = Date.parse(startedAt) - 5000;
  const startSec = Math.floor(start / 1000);
  const idMap = new Map<string, string>();
  const mask = (v: any): any => {
    if (typeof v === 'string') {
      if (OID.test(v) && parseInt(v.slice(0, 8), 16) >= startSec) {
        if (!idMap.has(v)) idMap.set(v, `<new-id-${idMap.size + 1}>`);
        return idMap.get(v);
      }
      if (ISO.test(v) && Date.parse(v) >= start) return '<now>';
      // New ids quoted inside a longer string - a message, an error page.
      if (/[0-9a-f]{24}/.test(v)) {
        v = v.replace(/(?<![0-9a-f])[0-9a-f]{24}(?![0-9a-f])/g, (id: string) => {
          if (parseInt(id.slice(0, 8), 16) < startSec) return id;
          if (!idMap.has(id)) idMap.set(id, `<new-id-${idMap.size + 1}>`);
          return idMap.get(id)!;
        });
      }
      // Access / refresh tokens carry their issue time, so no two runs agree.
      if (JWT.test(v)) return '<jwt>';
      return v;
    }
    if (Array.isArray(v)) return v.map(mask);
    if (v && typeof v === 'object') {
      const o: any = {};
      // Mongoose's internal version counter; Postgres has no such thing and
      // the frontend never reads it.
      for (const k of Object.keys(v).sort()) if (k !== '__v') o[k] = mask(v[k]);
      return o;
    }
    return v;
  };
  return mask;
}

/**
 * The fields migration/roundtrip-check.ts found missing from some stored
 * documents, with the default Postgres now holds for them.
 */
const LEGACY_DEFAULTS: Record<string, unknown> = {
  lineDiscountAmount: 0,
  processingMode: 'In-house',
  outsourceLab: '',
  referralRate: 0,
  packageName: '',
  cancelled: false,
  cancellationReason: '',
  refundedAmount: 0,
  retainedAmount: 0,
  discountDoctorName: '',
  referralTotal: 0,
  paymentBreakdown: [],
  revisions: [],
  tpa: null,
  reportTemplate: null,
  formula: '',
  outsourceCost: 0,
  interpretationTitle: '',
  interpretation: '',
  flagManual: false,
  highRange: '',
  lowRange: '',
  formulaOverride: false,
  kind: 'reference',
};

/**
 * Single values that differ on purpose, wherever they turn up. Each names the
 * old behaviour and says why Postgres does not reproduce it.
 */
const KNOWN_VALUES: { reason: string; matches: (path: string, mongo: any, pg: any) => boolean }[] = [
  {
    reason:
      'A result sheet opened before any result existed stored `enteredBy.userId` as the populated patient document ' +
      'turned into text by Mongoose ("{ _id: new ObjectId(...), uhid: ... }"); Postgres stores that patient\'s id.',
    matches: (path, mongo, pg) =>
      /enteredBy\.userId$/.test(path) &&
      typeof mongo === 'string' &&
      typeof pg === 'string' &&
      mongo.startsWith(`{\n  _id: new ObjectId('${pg}')`),
  },
  {
    reason:
      'A draw marked Collected without a time is stamped with the clock (HH:MM) at the moment of the request, ' +
      'so two runs minutes apart differ.',
    matches: (path, mongo, pg) =>
      /collectionTime$/.test(path) && /^\d\d:\d\d$/.test(String(mongo)) && /^\d\d:\d\d$/.test(String(pg)),
  },
  {
    reason:
      'A field older documents were saved without. Mongo sent nothing for it where a route read the raw document ' +
      '(`.lean()`, an aggregation); Postgres has the schema default in the column, so it is sent.',
    matches: (path, mongo, pg) => {
      if (mongo !== undefined) return false;
      const field = path.split('.').pop() as string;
      return field in LEGACY_DEFAULTS && JSON.stringify(LEGACY_DEFAULTS[field]) === JSON.stringify(pg);
    },
  },
  {
    reason:
      'The payment gateway simulator draws a fresh payer token, UTR, RRN, approval code and card digits for every ' +
      'attempt, and counts down the seconds left - so they differ between any two runs.',
    matches: (path, mongo, pg) => {
      const field = path.split('.').pop() as string;
      if (field === 'payerToken') return /^[0-9a-f]{48}$/.test(String(mongo)) && /^[0-9a-f]{48}$/.test(String(pg));
      if (field === 'secondsLeft') return typeof mongo === 'number' && typeof pg === 'number' && Math.abs(mongo - pg) <= 3;
      if (!['utr', 'rrn', 'authCode', 'cardLast4', 'transactionRef', 'notes', 'reference'].includes(field)) return false;
      const digitsOut = (v: unknown) => String(v).replace(/\d{4,}/g, '#');
      return typeof mongo === 'string' && typeof pg === 'string' && /\d{4,}/.test(mongo) && digitsOut(mongo) === digitsOut(pg);
    },
  },
];
const knownValueHits = new Map<string, number>();

function diff(x: any, y: any, path = ''): string[] {
  if (JSON.stringify(x) === JSON.stringify(y)) return [];
  const objects = x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y);
  if (!objects) {
    const rule = KNOWN_VALUES.find((r) => r.matches(path, x, y));
    if (rule) {
      knownValueHits.set(rule.reason, (knownValueHits.get(rule.reason) || 0) + 1);
      return [];
    }
    const show = (v: any) => (v === undefined ? '(absent)' : JSON.stringify(v)?.slice(0, 160));
    return [`${path || '(root)'}: ${show(x)}  !=  ${show(y)}`];
  }
  if (Array.isArray(x) && x.length !== y.length) {
    return [`${path}: array length ${x.length} != ${y.length}`, ...diff(x.slice(0, y.length), y.slice(0, x.length), path)];
  }
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...keys].flatMap((k) => diff(x[k], y[k], path ? `${path}.${k}` : k));
}

/** Rows of an `unordered` route, put in a fixed order so only their contents are compared. */
const settle = (record: any, body: any) => {
  if (!record.unordered) return body;
  const sortRows = (v: any): any =>
    Array.isArray(v) ? [...v].sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q))) : v;
  return body && typeof body === 'object' && 'data' in body ? { ...body, data: sortRows(body.data) } : sortRows(body);
};

const maskA = masker(a.startedAt);
const maskB = masker(b.startedAt);
const byName = new Map(b.records.map((r: any) => [r.name, r]));

const known: string[] = [];
let failed = 0;
let compared = 0;
let skipped = 0;
for (const ra of a.records) {
  const rb: any = byName.get(ra.name);
  // A partial run (--only) records a subset; the rest is not compared.
  if (!rb) {
    skipped++;
    continue;
  }
  compared++;
  const differences = [
    ...(ra.status !== rb.status ? [`status ${ra.status} != ${rb.status}`] : []),
    ...diff(settle(ra, maskA(ra.body)), settle(rb, maskB(rb.body))),
  ];
  if (differences.length && ra.known) {
    // Differs on purpose (see the step's `known` note); shown, not counted.
    known.push([`~ ${ra.name}  ${ra.method} ${ra.url}`, `    (${ra.known})`, ...differences.slice(0, 6).map((d) => `    ${d}`)].join('\n'));
  } else if (differences.length) {
    failed++;
    console.log(`✗ ${ra.name}  ${ra.method} ${ra.url}`);
    for (const d of differences.slice(0, 15)) console.log(`    ${d}`);
    if (differences.length > 15) console.log(`    ... ${differences.length - 15} more`);
  }
}

if (known.length) console.log(`\nKnown, intended differences (${known.length}):\n${known.join('\n')}`);
for (const [reason, hits] of knownValueHits) console.log(`\n~ known value difference, ${hits} occurrence(s): ${reason}`);
console.log(
  `\n${compared - failed - known.length}/${compared} responses identical` +
    (known.length ? `, ${known.length} known difference(s)` : '') +
    (failed ? `, ${failed} FAILING` : '') +
    (skipped ? ` (${skipped} not recorded in the second run)` : '') +
    '.'
);
process.exitCode = failed ? 1 : 0;
