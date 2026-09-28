/**
 * Gives an enquiry number to every visit raised before enquiry numbers existed.
 *
 * Without this those bills and reports print "-" where the number belongs, and
 * a patient holding an older report has nothing to quote when they ring. Each
 * invoice gets one, and its samples and results are stamped with the same one,
 * because they are all the same visit.
 *
 * Numbers are handed out oldest visit first, so they run in the order the
 * visits actually happened rather than in whatever order the database returns.
 *
 * Safe to re-run: an invoice that already has a number is left alone, and so
 * are its samples and results.
 *
 *   npm run backfill:enquiry              # fill in the missing ones
 *   npm run backfill:enquiry -- --dry-run # show what would change
 */
import dotenv from 'dotenv';
import { prisma, describeDatabase } from '../db/prisma';
import { mongoSort } from '../db/repo';
import { getNextEnquiryNumber } from '../db/counters';

dotenv.config();

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  const uri = describeDatabase();
  await prisma.$connect();
  console.log(`Connected to ${uri}\n`);

  const missing = await prisma.invoice.findMany({
    where: { OR: [{ enquiryNo: null }, { enquiryNo: '' }] },
    orderBy: mongoSort('invoice', { createdAt: 1 }),
    select: { id: true, invoiceNumber: true, uhid: true, createdAt: true },
  });

  const total = await prisma.invoice.count();
  console.log(`Invoices on record      : ${total}`);
  console.log(`Without enquiry number  : ${missing.length}\n`);

  if (!missing.length) {
    console.log('Nothing to do - every visit already has an enquiry number.');
    await prisma.$disconnect();
    return;
  }

  let filled = 0;
  let stampedSamples = 0;
  let stampedResults = 0;

  for (const invoice of missing) {
    // Drawn even on a dry run would burn numbers out of the counter, so the
    // preview shows the bill it would stamp rather than the number it is given.
    if (dryRun) {
      const raisedOn: Date | null = invoice.createdAt;
      const day = raisedOn ? new Date(raisedOn).toISOString().slice(0, 10) : 'date unknown';
      console.log(`  would number ${invoice.invoiceNumber} (${day})`);
      filled += 1;
      continue;
    }

    const enquiryNo = await getNextEnquiryNumber();
    await prisma.invoice.update({ where: { id: invoice.id }, data: { enquiryNo } });

    const sampleWrite = await prisma.sample.updateMany({ where: { invoiceId: invoice.id }, data: { enquiryNo } });
    const resultWrite = await prisma.result.updateMany({ where: { invoiceId: invoice.id }, data: { enquiryNo } });

    stampedSamples += sampleWrite.count;
    stampedResults += resultWrite.count;
    filled += 1;

    console.log(`  ${invoice.invoiceNumber} -> ${enquiryNo}`);
  }

  console.log(`\n${dryRun ? 'Would number' : 'Numbered'} : ${filled} visit(s)`);
  if (!dryRun) {
    console.log(`Samples stamped        : ${stampedSamples}`);
    console.log(`Results stamped        : ${stampedResults}`);
  }

  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error('Backfill failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
