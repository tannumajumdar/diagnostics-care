/**
 * Puts the standard formulas on the calculated lines of tests already on the
 * menu - MCV/MCH/MCHC, LDL/VLDL, Globulin and A/G, BUN, eAG, transferrin
 * saturation and the rest in constants/parameter-formulas.
 *
 * Safe to re-run: a line that already has a formula - typed by the lab or put
 * there by an earlier run - is left exactly as it is, and a line whose inputs
 * are not on the test stays a typed line.
 *
 *   npm run backfill:formulas              # write the formulas
 *   npm run backfill:formulas -- --dry-run # show what would change
 */
import dotenv from 'dotenv';
import { prisma, describeDatabase } from '../db/prisma';
import { repo, NATURAL } from '../db/repo';
import { withStandardFormulas } from '../constants/parameter-formulas';
import { formulaKey, formulaProblem } from '../utils/formula.util';

dotenv.config();

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  // Prisma reads DATABASE_URL itself; connecting up front makes a bad URL fail
  // here, before anything is read. The password is not printed.
  const uri = describeDatabase();
  await prisma.$connect();
  console.log(`Connected to ${uri}${dryRun ? ' (dry run)' : ''}`);

  const tests = await repo.find('labTest', { orderBy: NATURAL });
  let changedTests = 0;

  for (const test of tests) {
    // A copy of each line, as toObject() gave, so `before` stays as it was read.
    const before = (test.parameters || []).map((p: any) => ({ ...p }));
    const after = withStandardFormulas(before);

    const known = new Set<string>();
    after.forEach((p: any) => {
      if (p.resultType === 'Header') return;
      if (p.shortName) known.add(formulaKey(p.shortName));
      if (p.parameterName) known.add(formulaKey(p.parameterName));
    });

    const added = new Map<string, string>();
    after.forEach((p: any, i: number) => {
      if (p.formula && !before[i].formula) added.set(p.parameterName, p.formula);
    });
    if (!added.size) continue;

    for (const [name, formula] of added) {
      const problem = formulaProblem(formula, known);
      if (problem) throw new Error(`${test.testName} / ${name}: ${problem} (${formula})`);
    }

    changedTests += 1;
    console.log(`\n${test.testName} (${test.testCode})`);
    added.forEach((formula, name) => console.log(`  ${name} = ${formula}`));

    if (!dryRun) {
      test.parameters = after as any;
      await repo.save('labTest', test);
    }
  }

  console.log(`\n${changedTests} test(s) ${dryRun ? 'would get' : 'got'} formulas.`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
