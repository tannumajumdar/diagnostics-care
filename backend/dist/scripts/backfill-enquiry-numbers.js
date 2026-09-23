"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const invoice_model_1 = require("../models/invoice.model");
const sample_model_1 = require("../models/sample.model");
const result_model_1 = require("../models/result.model");
const counter_model_1 = require("../models/counter.model");
dotenv_1.default.config();
const run = async () => {
    const dryRun = process.argv.includes('--dry-run');
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(uri);
    console.log(`Connected to ${uri}\n`);
    const missing = await invoice_model_1.Invoice.find({
        $or: [{ enquiryNo: { $exists: false } }, { enquiryNo: null }, { enquiryNo: '' }],
    })
        .sort({ createdAt: 1 })
        .select('_id invoiceNumber uhid createdAt')
        .lean();
    const total = await invoice_model_1.Invoice.countDocuments();
    console.log(`Invoices on record      : ${total}`);
    console.log(`Without enquiry number  : ${missing.length}\n`);
    if (!missing.length) {
        console.log('Nothing to do - every visit already has an enquiry number.');
        await mongoose_1.default.disconnect();
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
            const raisedOn = invoice.createdAt;
            const day = raisedOn ? new Date(raisedOn).toISOString().slice(0, 10) : 'date unknown';
            console.log(`  would number ${invoice.invoiceNumber} (${day})`);
            filled += 1;
            continue;
        }
        const enquiryNo = await (0, counter_model_1.getNextEnquiryNumber)();
        await invoice_model_1.Invoice.updateOne({ _id: invoice._id }, { $set: { enquiryNo } });
        const sampleWrite = await sample_model_1.Sample.updateMany({ invoice: invoice._id }, { $set: { enquiryNo } });
        const resultWrite = await result_model_1.Result.updateMany({ invoice: invoice._id }, { $set: { enquiryNo } });
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
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Backfill failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
