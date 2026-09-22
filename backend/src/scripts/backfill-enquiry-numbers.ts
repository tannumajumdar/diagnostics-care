/**
 * Gives an enquiry number to every visit raised before enquiry numbers existed.
 *
 * Without this those bills and reports print "-" where the number belongs, and
 * a patient holding an older report has nothing to quote when they ring. Each
 * invoice gets one, and its samples and results are stamped with the same one,
 * because they are all the same visit.
 *
 * Numbers are handed out oldest visit first, so they run in the order the
 * visits actually happened rather than in whatever order Mongo returns.
 *
 * Safe to re-run: an invoice that already has a number is left alone, and so
 * are its samples and results.
 *
 *   npm run backfill:enquiry              # fill in the missing ones
 *   npm run backfill:enquiry -- --dry-run # show what would change
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Invoice } from '../models/invoice.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { getNextEnquiryNumber } from '../models/counter.model';

dotenv.config();

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
  await mongoose.connect(uri);
  console.log(`Connected to ${uri}\n`);

  const missing = await Invoice.find({
    $or: [{ enquiryNo: { $exists: false } }, { enquiryNo: null }, { enquiryNo: '' }],
  })
    .sort({ createdAt: 1 })
    .select('_id invoiceNumber uhid createdAt')
    .lean();

  const total = await Invoice.countDocuments();
  console.log(`Invoices on record      : ${total}`);
  console.log(`Without enquiry number  : ${missing.length}\n`);

  if (!missing.length) {
    console.log('Nothing to do - every visit already has an enquiry number.');
    await mongoose.disconnect();
    return;
  }

  let filled = 0;
  let stampedSamples = 0;
  let stampedResults = 0;

  for (const invoice of missing) {
    // Drawn even on a dry run would burn numbers out of the counter, so the
    // preview shows the bill it would stamp rather than the number it is given.
    if (dryRun) {
      // `timestamps: true` adds createdAt at runtime but not to the interface.
      const raisedOn = (invoice as { createdAt?: Date }).createdAt;
      const day = raisedOn ? new Date(raisedOn).toISOString().slice(0, 10) : 'date unknown';
      console.log(`  would number ${invoice.invoiceNumber} (${day})`);
      filled += 1;
      continue;
    }

    const enquiryNo = await getNextEnquiryNumber();
    await Invoice.updateOne({ _id: invoice._id }, { $set: { enquiryNo } });

    const sampleWrite = await Sample.updateMany({ invoice: invoice._id }, { $set: { enquiryNo } });
    const resultWrite = await Result.updateMany({ invoice: invoice._id }, { $set: { enquiryNo } });

    stampedSamples += sampleWrite.modifiedCount;
    stampedResults += resultWrite.modifiedCount;
    filled += 1;

    console.log(`  ${invoice.invoiceNumber} -> ${enquiryNo}`);
  }

  console.log(`\n${dryRun ? 'Would number' : 'Numbered'} : ${filled} visit(s)`);
  if (!dryRun) {
    console.log(`Samples stamped        : ${stampedSamples}`);
    console.log(`Results stamped        : ${stampedResults}`);
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Backfill failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
