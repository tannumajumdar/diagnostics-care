/**
 * Puts every test's parameters into the band layout the parameter master shows,
 * so what is stored is what the grid displays:
 *
 *  - a line still carrying male / female / child strings is split into band
 *    rows (child under 12 years; MALE / FEMALE, or ALL when both match);
 *  - an open-ended age window (AGE TO 0) is written as 0 - 54750 days, the
 *    "every age" the lab's desktop screen used;
 *  - header rows keep 0 / 0.
 *
 * Lines already in the band layout keep their values. Every test's current
 * parameters are saved to backups/ before anything is written.
 *
 * Run: npx ts-node --transpile-only src/scripts/normalise-parameter-bands.ts [--dry-run]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { LabTest } from '../models/test.model';

const FULL_LIFE_DAYS = 54750;
const CHILD_UP_TO_DAYS = 12 * 365 - 1;

const parseRange = (range: string) => {
  const r = range.trim();
  const band = r.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (band) return { minValue: band[1], maxValue: band[2], referenceText: '' };
  const upper = r.match(/^<\s*=?\s*([\d.]+)$/);
  if (upper) return { minValue: '', maxValue: upper[1], referenceText: '' };
  const lower = r.match(/^>\s*=?\s*([\d.]+)$/);
  if (lower) return { minValue: lower[1], maxValue: '', referenceText: '' };
  return { minValue: '', maxValue: '', referenceText: r };
};

const toBands = (p: any): any[] => {
  if (p.resultType === 'Header') return [{ ...p, ageFromDays: 0, ageToDays: 0 }];

  const male = String(p.maleReferenceRange || '').trim();
  const female = String(p.femaleReferenceRange || '').trim();
  const child = String(p.childReferenceRange || '').trim();
  const fullLife = (row: any) => (Number(row.ageToDays) > 0 ? row : { ...row, ageToDays: FULL_LIFE_DAYS });

  if (!male && !female && !child) return [fullLife({ paraFor: 'ALL', ageFromDays: 0, ...p })];

  const base = { ...p, maleReferenceRange: '', femaleReferenceRange: '', childReferenceRange: '' };
  const adultFrom = child ? CHILD_UP_TO_DAYS + 1 : 0;
  const rows: any[] = [];
  if (child) rows.push({ ...base, ...parseRange(child), paraFor: 'ALL', ageFromDays: 0, ageToDays: CHILD_UP_TO_DAYS });
  if (male && female && male !== female) {
    rows.push({ ...base, ...parseRange(male), paraFor: 'MALE', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
    rows.push({ ...base, ...parseRange(female), paraFor: 'FEMALE', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
  } else {
    rows.push({ ...base, ...parseRange(male || female), paraFor: 'ALL', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
  }
  return rows;
};

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI as string);
  const all = await LabTest.find({}, { testCode: 1, testName: 1, parameters: 1 }).lean();

  if (!dryRun) {
    const dir = path.join(__dirname, '../../backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `parameters-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(all.map((t: any) => ({ _id: t._id, testCode: t.testCode, parameters: t.parameters })), null, 2)
    );
    console.log(`Backup of ${all.length} tests: ${file}`);
  }

  let changed = 0;
  for (const t of all as any[]) {
    const before = t.parameters || [];
    const after = before.flatMap(toBands);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changed += 1;
    console.log(`${dryRun ? '[dry] ' : ''}${String(t.testCode).padEnd(9)} ${before.length} -> ${after.length} rows`);
    if (!dryRun) await LabTest.updateOne({ _id: t._id }, { $set: { parameters: after } }, { runValidators: true });
  }
  console.log(`${dryRun ? 'Would change' : 'Changed'} ${changed} of ${all.length} tests.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
