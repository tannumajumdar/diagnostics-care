"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Writes the Full Body Checkup menu onto the test master and assembles it
 * into one sellable package.
 *
 * Sixteen panels, each with the parameters, units, adult intervals and
 * methods a report has to print beside a number. A panel that is already on
 * the master - by code or by name - is left exactly as it is, because rates
 * the centre has tuned and sheets it has edited are its own. The package is
 * then built out of whatever is on the master, existing panels included, so
 * running this on a centre that already has a CBC does not give it a second
 * one.
 *
 * Additive and safe to re-run. Nothing is ever deleted.
 *
 *   npm run seed:checkup                     # add what is missing, build the package
 *   npm run seed:checkup -- --dry-run        # show what would happen, change nothing
 *   npm run seed:checkup -- --update-sheets  # also overwrite existing panels' parameter sheets
 *
 * `--update-sheets` is the one destructive option: it replaces the parameter
 * sheet of a panel that already exists with the one in this file. Use it when
 * the centre wants these intervals and methods to win; without it, an edited
 * sheet is never touched.
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const department_model_1 = require("../models/department.model");
const test_model_1 = require("../models/test.model");
const package_model_1 = require("../models/package.model");
const full_body_checkup_1 = require("../constants/full-body-checkup");
dotenv_1.default.config();
const DEPARTMENTS = {
    PATH: { departmentName: 'Pathology', description: 'General Pathology' },
    BIO: { departmentName: 'Biochemistry', description: 'Clinical Biochemistry' },
    HEMA: { departmentName: 'Hematology', description: 'Blood Cell Studies' },
    MICRO: { departmentName: 'Microbiology', description: 'Bacterial Studies' },
};
const rupees = (value) => `Rs.${value.toLocaleString('en-IN')}`;
const run = async () => {
    const dryRun = process.argv.includes('--dry-run');
    const updateSheets = process.argv.includes('--update-sheets');
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(uri);
    console.log(`Connected to ${uri}${dryRun ? '  [dry-run - nothing will be written]' : ''}\n`);
    // --- Departments the panels sit under -----------------------------------
    const deptIds = new Map();
    const needed = [...new Set(full_body_checkup_1.CHECKUP_PANELS.map((p) => p.dept))];
    for (const code of needed) {
        const meta = DEPARTMENTS[code];
        let dept = await department_model_1.Department.findOne({ departmentCode: code });
        if (!dept) {
            if (dryRun) {
                console.log(`[dry-run] would create department ${meta.departmentName} (${code})`);
            }
            else {
                dept = await department_model_1.Department.create({
                    departmentName: meta.departmentName,
                    departmentCode: code,
                    description: meta.description,
                    status: 'Active',
                });
                console.log(`Created department ${meta.departmentName} (${code})`);
            }
        }
        if (dept)
            deptIds.set(code, dept._id);
    }
    // --- The panels ----------------------------------------------------------
    const existing = await test_model_1.LabTest.find({}, 'testCode testName');
    const byCode = new Map(existing.map((t) => [String(t.testCode).trim().toUpperCase(), t]));
    const byName = new Map(existing.map((t) => [String(t.testName).trim().toLowerCase(), t]));
    /** The ids that end up in the package - created now or already on the master. */
    const packageTestIds = [];
    // A dry run has no ids to collect, so the panels it would have created are
    // counted separately - a preview that says "3 tests" for a run that would
    // build a package of sixteen is worse than no preview at all.
    let wouldInclude = 0;
    let created = 0;
    let reused = 0;
    let resheeted = 0;
    let unplaced = 0;
    for (const panel of full_body_checkup_1.CHECKUP_PANELS) {
        const already = byCode.get(panel.testCode.toUpperCase()) || byName.get(panel.testName.trim().toLowerCase());
        if (already) {
            reused += 1;
            wouldInclude += 1;
            packageTestIds.push(already._id);
            console.log(`= ${panel.testName} - already on the master as ${already.testCode}, left as it is` +
                (updateSheets ? '' : ' (--update-sheets to replace its sheet)'));
            if (updateSheets && !dryRun) {
                await test_model_1.LabTest.findByIdAndUpdate(already._id, {
                    parameters: panel.parameters.map((p, idx) => ({ ...p, displayOrder: idx + 1 })),
                });
                resheeted += 1;
                console.log(`    sheet replaced - ${panel.parameters.length} parameter(s)`);
            }
            else if (updateSheets && dryRun) {
                resheeted += 1;
                console.log(`    [dry-run] would replace its sheet with ${panel.parameters.length} parameter(s)`);
            }
            continue;
        }
        const departmentId = deptIds.get(panel.dept);
        if (!departmentId) {
            unplaced += 1;
            console.log(`! ${panel.testName} - department ${panel.dept} is not on this database, skipped`);
            continue;
        }
        const doc = {
            testName: panel.testName,
            testCode: panel.testCode,
            department: departmentId,
            testType: 'Profile',
            sampleType: panel.sampleType,
            sampleContainer: panel.sampleContainer,
            rate: panel.rate,
            patientRate: panel.rate,
            corporateRate: Math.round(panel.rate * 0.8),
            doctorRate: Math.round(panel.rate * 0.7),
            emergencyRate: Math.round(panel.rate * 1.5),
            // The doctor's own copy prints a little above the centre's rate; the
            // gap is the referring doctor's cut and the Admin tunes it under Rates.
            referralRate: Math.round(panel.rate * 1.2),
            processingMode: 'In-house',
            outsourceLab: '',
            outsourceCost: 0,
            discountAllowed: true,
            fastingRequired: !!panel.fasting,
            preparationRequired: panel.fasting ? '10-12 hours overnight fasting; water is allowed.' : '',
            turnaroundTime: panel.tat || '24 Hours',
            status: 'Active',
            parameters: panel.parameters.map((p, idx) => ({ ...p, displayOrder: idx + 1 })),
        };
        if (dryRun) {
            console.log(`[dry-run] + ${panel.testName} (${panel.testCode}) - ${rupees(panel.rate)}, ${panel.parameters.length} parameter(s)`);
            created += 1;
            wouldInclude += 1;
            continue;
        }
        const saved = await test_model_1.LabTest.create(doc);
        packageTestIds.push(saved._id);
        created += 1;
        console.log(`+ ${panel.testName} (${panel.testCode}) - ${rupees(panel.rate)}, ${panel.parameters.length} parameter(s)`);
    }
    // --- The package ---------------------------------------------------------
    // Built from whatever is actually on the master, so a centre that already
    // ran its own CBC gets that one in the panel rather than a duplicate.
    let packageNote = '';
    if (dryRun) {
        const held = await package_model_1.TestPackage.findOne({ packageCode: full_body_checkup_1.CHECKUP_PACKAGE.packageCode });
        packageNote = `[dry-run] would ${held ? 'update' : 'create'} package ${full_body_checkup_1.CHECKUP_PACKAGE.packageName} (${full_body_checkup_1.CHECKUP_PACKAGE.packageCode}) with ${wouldInclude} test(s)`;
    }
    else if (!packageTestIds.length) {
        packageNote = 'No tests resolved, so no package was built.';
    }
    else {
        const existingPackage = await package_model_1.TestPackage.findOne({ packageCode: full_body_checkup_1.CHECKUP_PACKAGE.packageCode });
        if (existingPackage) {
            // The price is the centre's own decision once the package exists, so
            // only the test list is brought up to date.
            existingPackage.tests = packageTestIds;
            await existingPackage.save();
            packageNote = `= ${full_body_checkup_1.CHECKUP_PACKAGE.packageName} already existed - its test list now holds ${packageTestIds.length} test(s), its price left at ${rupees(existingPackage.rate)}`;
        }
        else {
            const saved = await package_model_1.TestPackage.create({
                ...full_body_checkup_1.CHECKUP_PACKAGE,
                tests: packageTestIds,
                status: 'Active',
            });
            packageNote = `+ ${saved.packageName} (${saved.packageCode}) - ${packageTestIds.length} test(s) at ${rupees(saved.rate)}`;
        }
    }
    const panelTotal = full_body_checkup_1.CHECKUP_LIST_TOTAL;
    const saving = panelTotal - full_body_checkup_1.CHECKUP_PACKAGE.rate;
    console.log('\n--- Summary ---');
    console.log(`Panels in this file     : ${full_body_checkup_1.CHECKUP_PANELS.length}`);
    console.log(`${dryRun ? 'Would add' : 'Added'}               : ${created}`);
    console.log(`Already on the master   : ${reused}`);
    if (updateSheets)
        console.log(`Sheets replaced         : ${resheeted}`);
    if (unplaced)
        console.log(`Skipped (no department) : ${unplaced}`);
    console.log(`Parameters in the set   : ${full_body_checkup_1.CHECKUP_PANELS.reduce((s, p) => s + p.parameters.length, 0)}`);
    console.log(`Panels billed one by one: ${rupees(panelTotal)}`);
    console.log(`Package price           : ${rupees(full_body_checkup_1.CHECKUP_PACKAGE.rate)}` +
        (saving > 0 ? `  (saves the patient ${rupees(saving)})` : ''));
    console.log(packageNote);
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Seeding the Full Body Checkup failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
