/**
 * Fills in the parameter sheet for tests that were created without one.
 *
 * The catalogue only helps tests created after it existed. Anything already on
 * the menu still has an empty `parameters` array, which means result entry
 * opens on a blank grid and the report prints an empty table. This walks the
 * existing menu once and gives every such test its sheet.
 *
 * Safe to re-run: a test that already has parameters - typed by hand or filled
 * by an earlier run - is left exactly as it is.
 *
 *   npm run backfill:parameters              # only tests with no parameters
 *   npm run backfill:parameters -- --dry-run # show what would change
 *   npm run backfill:parameters -- --generic # also give unmatched tests a line
 */
import dotenv from 'dotenv';
import { prisma, describeDatabase } from '../db/prisma';
import { repo, NATURAL } from '../db/repo';
import { findParameterTemplate, parametersForTest } from '../constants/test-parameters';

dotenv.config();

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const useGeneric = process.argv.includes('--generic');

  // Prisma reads DATABASE_URL itself; connecting up front makes a bad URL fail
  // here, before anything is read. The password is not printed.
  const uri = describeDatabase();
  await prisma.$connect();
  console.log(`Connected to ${uri}`);

  const tests = await repo.find('labTest', { orderBy: NATURAL });
  let filled = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const test of tests) {
    if (Array.isArray(test.parameters) && test.parameters.length > 0) {
      skipped += 1;
      continue;
    }

    const matched = findParameterTemplate(test.testName, test.testCode);
    if (!matched.length && !useGeneric) {
      unmatched.push(`${test.testName} (${test.testCode})`);
      continue;
    }

    const sheet = matched.length ? matched : parametersForTest(test.testName, test.testCode);
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${test.testName} (${test.testCode}) -> ${sheet.length} parameter(s): ${sheet
        .map((p) => p.parameterName)
        .join(', ')}`
    );

    if (!dryRun) {
      test.parameters = sheet as any;
      await repo.save('labTest', test);
    }
    filled += 1;
  }

  console.log('\n--- Summary ---');
  console.log(`Tests on the menu      : ${tests.length}`);
  console.log(`Already had parameters : ${skipped}`);
  console.log(`${dryRun ? 'Would fill' : 'Filled'} in           : ${filled}`);

  if (unmatched.length) {
    console.log(`\nNo catalogue match for ${unmatched.length} test(s) - left untouched:`);
    unmatched.forEach((name) => console.log(`  - ${name}`));
    console.log(
      '\nAdd them to src/constants/test-parameters.ts, type them on the test master,'
    );
    console.log('or re-run with --generic to give each a single free-text result line.');
  }

  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error('Backfill failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
