/**
 * Fills HIGH RANGE / LOW RANGE on every parameter row that has them blank,
 * from the row's own MAX / MIN - the values the flag was already read against,
 * so no result flags differently. Header and text lines are left alone, and a
 * value someone already typed in is kept.
 *
 * Every test's current parameters are saved to backups/ before anything is written.
 *
 * Run: npx ts-node --transpile-only src/scripts/fill-high-low-ranges.ts [--dry-run]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { LabTest } from '../models/test.model';

const blank = (v: unknown) => !String(v ?? '').trim();

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI as string);

  const all = await LabTest.find({}, { testName: 1, testCode: 1, parameters: 1 }).lean();
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

  let tests = 0;
  let rows = 0;
  for (const test of all as any[]) {
    let changed = 0;
    const parameters = (test.parameters || []).map((p: any) => {
      if (p.resultType === 'Header') return p;
      const next = { ...p };
      if (blank(p.highRange) && !blank(p.maxValue)) next.highRange = String(p.maxValue).trim();
      if (blank(p.lowRange) && !blank(p.minValue)) next.lowRange = String(p.minValue).trim();
      if (next.highRange !== p.highRange || next.lowRange !== p.lowRange) changed += 1;
      return next;
    });
    if (!changed) continue;

    console.log(`${dryRun ? '[dry] ' : ''}${String(test.testCode).padEnd(9)} ${test.testName} -> ${changed} rows`);
    tests += 1;
    rows += changed;
    if (!dryRun) {
      await LabTest.updateOne({ _id: test._id }, { $set: { parameters } }, { runValidators: true });
    }
  }

  console.log(`${dryRun ? 'Dry run - would fill' : 'Filled'} ${rows} rows across ${tests} tests.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
