"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const test_model_1 = require("../models/test.model");
const test_parameters_1 = require("../constants/test-parameters");
dotenv_1.default.config();
const run = async () => {
    const dryRun = process.argv.includes('--dry-run');
    const useGeneric = process.argv.includes('--generic');
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(uri);
    console.log(`Connected to ${uri}`);
    const tests = await test_model_1.LabTest.find({});
    let filled = 0;
    let skipped = 0;
    const unmatched = [];
    for (const test of tests) {
        if (Array.isArray(test.parameters) && test.parameters.length > 0) {
            skipped += 1;
            continue;
        }
        const matched = (0, test_parameters_1.findParameterTemplate)(test.testName, test.testCode);
        if (!matched.length && !useGeneric) {
            unmatched.push(`${test.testName} (${test.testCode})`);
            continue;
        }
        const sheet = matched.length ? matched : (0, test_parameters_1.parametersForTest)(test.testName, test.testCode);
        console.log(`${dryRun ? '[dry-run] ' : ''}${test.testName} (${test.testCode}) -> ${sheet.length} parameter(s): ${sheet
            .map((p) => p.parameterName)
            .join(', ')}`);
        if (!dryRun) {
            test.parameters = sheet;
            await test.save();
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
        console.log('\nAdd them to src/constants/test-parameters.ts, type them on the test master,');
        console.log('or re-run with --generic to give each a single free-text result line.');
    }
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Backfill failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
