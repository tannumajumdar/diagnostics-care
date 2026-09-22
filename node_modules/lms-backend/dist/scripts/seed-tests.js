"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Puts a real diagnostic menu on the test master.
 *
 * A centre that starts with three tests on the list is not a centre anyone can
 * bill from - the desk searches for "vitamin d" or "thyroid" and gets nothing,
 * so it has to stop and add each test by hand before it can take the first
 * patient. This writes the everyday Indian lab menu once: the tests, their
 * codes, the vial they are drawn into, the rate card and the parameter sheet
 * behind each one, so every test here can be billed, collected, entered and
 * printed the moment it lands.
 *
 * Additive and safe to re-run. A test whose code or name is already on the
 * master is left exactly as it is - rates the centre has tuned and parameter
 * sheets it has edited are never overwritten. Missing departments are created;
 * nothing is ever deleted.
 *
 *   npm run seed:tests              # add whatever is missing
 *   npm run seed:tests -- --dry-run # show what would be added
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const department_model_1 = require("../models/department.model");
const test_model_1 = require("../models/test.model");
const test_parameters_1 = require("../constants/test-parameters");
dotenv_1.default.config();
const DEPARTMENTS = {
    PATH: { departmentName: 'Pathology', description: 'General Pathology' },
    BIO: { departmentName: 'Biochemistry', description: 'Clinical Biochemistry' },
    HEMA: { departmentName: 'Hematology', description: 'Blood Cell Studies' },
    MICRO: { departmentName: 'Microbiology', description: 'Bacterial Studies' },
};
const SERUM = { sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial' };
const EDTA = { sampleType: 'Whole Blood', sampleContainer: 'EDTA Purple Top Vial' };
const FLUORIDE = { sampleType: 'Plasma', sampleContainer: 'Grey Top (Fluoride) Vial' };
const URINE = { sampleType: 'Urine', sampleContainer: 'Sterile Urine Container' };
const CITRATE = { sampleType: 'Plasma', sampleContainer: 'Blue Top (Citrate) Vial' };
/**
 * The menu itself. Rates are the usual small-centre figures and the centre
 * edits them under Rates; what matters here is that the names and codes are
 * the ones a receptionist would actually type into the search box.
 */
const MENU = [
    // --- Haematology ---
    { testName: 'Complete Blood Count (CBC)', testCode: 'CBC001', dept: 'HEMA', rate: 350, ...EDTA, tat: '4 Hours' },
    { testName: 'Haemoglobin (Hb) Estimation', testCode: 'HB001', dept: 'HEMA', rate: 120, ...EDTA, tat: '2 Hours' },
    { testName: 'Erythrocyte Sedimentation Rate (ESR)', testCode: 'ESR001', dept: 'HEMA', rate: 200, ...EDTA, tat: '4 Hours' },
    { testName: 'Total Leucocyte Count (TLC)', testCode: 'TLC001', dept: 'HEMA', rate: 150, ...EDTA, tat: '4 Hours' },
    { testName: 'Differential Leucocyte Count (DLC)', testCode: 'DLC001', dept: 'HEMA', rate: 150, ...EDTA, tat: '4 Hours' },
    { testName: 'Platelet Count', testCode: 'PLT001', dept: 'HEMA', rate: 200, ...EDTA, tat: '4 Hours' },
    { testName: 'Peripheral Blood Smear (PBS)', testCode: 'PBS001', dept: 'HEMA', rate: 300, ...EDTA, tat: '8 Hours' },
    { testName: 'Reticulocyte Count', testCode: 'RET001', dept: 'HEMA', rate: 300, ...EDTA, tat: '8 Hours' },
    { testName: 'Blood Group & Rh Typing', testCode: 'BGR001', dept: 'HEMA', rate: 200, ...EDTA, tat: '2 Hours' },
    { testName: 'Prothrombin Time with INR (PT INR)', testCode: 'PTI001', dept: 'HEMA', rate: 450, ...CITRATE, tat: '8 Hours' },
    { testName: 'Activated Partial Thromboplastin Time (APTT)', testCode: 'APT001', dept: 'HEMA', rate: 450, ...CITRATE, tat: '8 Hours' },
    { testName: 'Bleeding Time & Clotting Time (BT CT)', testCode: 'BTC001', dept: 'HEMA', rate: 200, ...EDTA, tat: '4 Hours' },
    { testName: 'Absolute Eosinophil Count (AEC)', testCode: 'AEC001', dept: 'HEMA', rate: 250, ...EDTA, tat: '4 Hours' },
    // --- Diabetes & sugars ---
    { testName: 'Fasting Blood Sugar (FBS)', testCode: 'FBS001', dept: 'BIO', rate: 200, ...FLUORIDE, fasting: true, tat: '4 Hours' },
    { testName: 'Post Prandial Blood Sugar (PPBS)', testCode: 'PPBS001', dept: 'BIO', rate: 200, ...FLUORIDE, tat: '4 Hours' },
    { testName: 'Random Blood Sugar (RBS)', testCode: 'RBS001', dept: 'BIO', rate: 180, ...FLUORIDE, tat: '2 Hours' },
    { testName: 'HbA1c (Glycated Hemoglobin)', testCode: 'HBA001', dept: 'BIO', rate: 650, ...EDTA, tat: '12 Hours' },
    { testName: 'Oral Glucose Tolerance Test (GTT)', testCode: 'GTT001', dept: 'BIO', rate: 600, ...FLUORIDE, fasting: true, tat: '8 Hours' },
    // --- Profiles ---
    { testName: 'Lipid Profile', testCode: 'LIP001', dept: 'BIO', rate: 900, ...SERUM, fasting: true, tat: '8 Hours', testType: 'Profile' },
    { testName: 'Liver Function Test (LFT)', testCode: 'LFT001', dept: 'BIO', rate: 950, ...SERUM, tat: '8 Hours', testType: 'Profile' },
    { testName: 'Kidney Function Test (KFT)', testCode: 'KFT001', dept: 'BIO', rate: 900, ...SERUM, tat: '8 Hours', testType: 'Profile' },
    { testName: 'Thyroid Profile (T3 T4 TSH)', testCode: 'TFT001', dept: 'BIO', rate: 700, ...SERUM, tat: '12 Hours', testType: 'Profile' },
    { testName: 'Serum Electrolytes (Na K Cl)', testCode: 'ELE001', dept: 'BIO', rate: 600, ...SERUM, tat: '8 Hours', testType: 'Profile' },
    { testName: 'Iron Studies Profile', testCode: 'IRN001', dept: 'BIO', rate: 1200, ...SERUM, fasting: true, tat: '24 Hours', testType: 'Profile' },
    // --- Single-analyte biochemistry ---
    { testName: 'Serum Creatinine', testCode: 'CRE001', dept: 'BIO', rate: 250, ...SERUM, tat: '4 Hours' },
    { testName: 'Blood Urea', testCode: 'URA001', dept: 'BIO', rate: 250, ...SERUM, tat: '4 Hours' },
    { testName: 'Serum Uric Acid', testCode: 'URC001', dept: 'BIO', rate: 300, ...SERUM, tat: '4 Hours' },
    { testName: 'Serum Calcium', testCode: 'CAL001', dept: 'BIO', rate: 300, ...SERUM, tat: '8 Hours' },
    { testName: 'Serum Bilirubin (Total & Direct)', testCode: 'BIL001', dept: 'BIO', rate: 300, ...SERUM, tat: '8 Hours' },
    { testName: 'Serum Amylase', testCode: 'AMY001', dept: 'BIO', rate: 550, ...SERUM, tat: '12 Hours' },
    { testName: 'Serum Lipase', testCode: 'LPS001', dept: 'BIO', rate: 650, ...SERUM, tat: '12 Hours' },
    { testName: 'Serum Magnesium', testCode: 'MAG001', dept: 'BIO', rate: 350, ...SERUM, tat: '12 Hours' },
    { testName: 'Serum Phosphorus', testCode: 'PHO001', dept: 'BIO', rate: 300, ...SERUM, tat: '12 Hours' },
    { testName: 'Serum Albumin', testCode: 'ALB001', dept: 'BIO', rate: 250, ...SERUM, tat: '8 Hours' },
    // --- Hormones & vitamins ---
    { testName: 'Thyroid Stimulating Hormone (TSH)', testCode: 'TSH001', dept: 'BIO', rate: 350, ...SERUM, tat: '12 Hours' },
    { testName: 'Vitamin D (25-OH Cholecalciferol)', testCode: 'VTD001', dept: 'BIO', rate: 1600, ...SERUM, tat: '24 Hours', testType: 'Special' },
    { testName: 'Vitamin B12 (Cobalamin)', testCode: 'VB12001', dept: 'BIO', rate: 1400, ...SERUM, tat: '24 Hours', testType: 'Special' },
    { testName: 'Beta HCG (Pregnancy - Serum)', testCode: 'BHCG001', dept: 'BIO', rate: 700, ...SERUM, tat: '12 Hours' },
    { testName: 'Urine Pregnancy Test (UPT)', testCode: 'UPT001', dept: 'PATH', rate: 150, ...URINE, tat: '1 Hour' },
    { testName: 'Prostate Specific Antigen (PSA)', testCode: 'PSA001', dept: 'BIO', rate: 900, ...SERUM, tat: '24 Hours', testType: 'Special' },
    // --- Serology & infection ---
    { testName: 'C-Reactive Protein (CRP)', testCode: 'CRP001', dept: 'BIO', rate: 500, ...SERUM, tat: '8 Hours' },
    { testName: 'Widal Test (Typhoid)', testCode: 'WID001', dept: 'MICRO', rate: 400, ...SERUM, tat: '12 Hours' },
    { testName: 'Dengue NS1, IgM & IgG', testCode: 'DEN001', dept: 'MICRO', rate: 1200, ...SERUM, tat: '12 Hours' },
    { testName: 'Malaria Parasite (MP) Smear & Antigen', testCode: 'MAL001', dept: 'MICRO', rate: 400, ...EDTA, tat: '4 Hours' },
    { testName: 'HIV I & II Antibody (Screening)', testCode: 'HIV001', dept: 'MICRO', rate: 600, ...SERUM, tat: '12 Hours' },
    { testName: 'HBsAg (Hepatitis B Surface Antigen)', testCode: 'HBS001', dept: 'MICRO', rate: 500, ...SERUM, tat: '12 Hours' },
    { testName: 'HCV Antibody (Hepatitis C)', testCode: 'HCV001', dept: 'MICRO', rate: 700, ...SERUM, tat: '12 Hours' },
    { testName: 'VDRL / RPR (Syphilis)', testCode: 'VDR001', dept: 'MICRO', rate: 350, ...SERUM, tat: '12 Hours' },
    { testName: 'Rheumatoid Factor (RA Factor)', testCode: 'RAF001', dept: 'MICRO', rate: 450, ...SERUM, tat: '12 Hours' },
    { testName: 'ASO Titre (Anti Streptolysin O)', testCode: 'ASO001', dept: 'MICRO', rate: 450, ...SERUM, tat: '12 Hours' },
    { testName: 'Typhidot (IgM & IgG)', testCode: 'TYP001', dept: 'MICRO', rate: 600, ...SERUM, tat: '12 Hours' },
    // --- Urine, stool & cultures ---
    { testName: 'Urine Routine Examination', testCode: 'URE001', dept: 'PATH', rate: 250, ...URINE, tat: '4 Hours' },
    { testName: 'Urine Culture & Sensitivity', testCode: 'UCS001', dept: 'MICRO', rate: 800, ...URINE, tat: '72 Hours', testType: 'Special' },
    { testName: 'Urine Microalbumin', testCode: 'UMA001', dept: 'BIO', rate: 600, ...URINE, tat: '24 Hours' },
    { testName: 'Stool Routine Examination', testCode: 'STR001', dept: 'PATH', rate: 250, sampleType: 'Stool', sampleContainer: 'Sterile Stool Container', tat: '8 Hours' },
    { testName: 'Blood Culture & Sensitivity', testCode: 'BCS001', dept: 'MICRO', rate: 1200, sampleType: 'Whole Blood', sampleContainer: 'Blood Culture Bottle', tat: '96 Hours', testType: 'Special' },
    { testName: 'Throat Swab Culture & Sensitivity', testCode: 'TSC001', dept: 'MICRO', rate: 800, sampleType: 'Swab', sampleContainer: 'Sterile Swab', tat: '72 Hours', testType: 'Special' },
    { testName: 'Sputum for AFB (Ziehl-Neelsen)', testCode: 'AFB001', dept: 'MICRO', rate: 350, sampleType: 'Sputum', sampleContainer: 'Sterile Sputum Container', tat: '24 Hours' },
    // --- Packages the desk sells as one line ---
    { testName: 'Full Body Health Checkup - Basic', testCode: 'PKG001', dept: 'PATH', rate: 1999, ...SERUM, fasting: true, tat: '24 Hours', testType: 'Profile' },
    { testName: 'Diabetic Care Package', testCode: 'PKG002', dept: 'BIO', rate: 1499, ...SERUM, fasting: true, tat: '24 Hours', testType: 'Profile' },
    { testName: 'Fever Panel (Basic)', testCode: 'PKG003', dept: 'MICRO', rate: 1799, ...SERUM, tat: '24 Hours', testType: 'Profile' },
    { testName: 'Antenatal Profile (First Visit)', testCode: 'PKG004', dept: 'PATH', rate: 2499, ...SERUM, tat: '24 Hours', testType: 'Profile' },
];
const run = async () => {
    const dryRun = process.argv.includes('--dry-run');
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(uri);
    console.log(`Connected to ${uri}`);
    // Departments first - a test cannot be saved without one, and a centre that
    // never created them should not have this run fail on every line.
    const deptIds = new Map();
    for (const code of Object.keys(DEPARTMENTS)) {
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
    const existing = await test_model_1.LabTest.find({}, 'testCode testName');
    const haveCode = new Set(existing.map((t) => String(t.testCode).trim().toUpperCase()));
    // A centre that typed a test by hand under its own code should not end up
    // with the same test on the menu twice under ours.
    const haveName = new Set(existing.map((t) => String(t.testName).trim().toLowerCase()));
    const toCreate = [];
    let skipped = 0;
    for (const entry of MENU) {
        if (haveCode.has(entry.testCode.toUpperCase()) || haveName.has(entry.testName.trim().toLowerCase())) {
            skipped += 1;
            continue;
        }
        const departmentId = deptIds.get(entry.dept);
        if (!departmentId) {
            console.log(`Skipping ${entry.testName} - department ${entry.dept} is not on this database yet`);
            continue;
        }
        const rate = entry.rate;
        toCreate.push({
            testName: entry.testName,
            testCode: entry.testCode,
            department: departmentId,
            testType: entry.testType || 'Routine',
            sampleType: entry.sampleType || 'Serum',
            sampleContainer: entry.sampleContainer || 'Yellow Top (SST) Vial',
            rate,
            patientRate: rate,
            corporateRate: Math.round(rate * 0.8),
            doctorRate: Math.round(rate * 0.7),
            emergencyRate: Math.round(rate * 1.5),
            discountAllowed: true,
            fastingRequired: !!entry.fasting,
            preparationRequired: entry.fasting ? '10-12 hours overnight fasting; water is allowed.' : '',
            turnaroundTime: entry.tat || '24 Hours',
            status: 'Active',
            // Every test goes on the menu with its sheet, so it is runnable end to
            // end the moment it is billed.
            parameters: (0, test_parameters_1.parametersForTest)(entry.testName, entry.testCode),
        });
    }
    if (!dryRun && toCreate.length) {
        await test_model_1.LabTest.create(toCreate);
    }
    toCreate.forEach((t) => console.log(`${dryRun ? '[dry-run] ' : ''}+ ${t.testName} (${t.testCode}) - Rs.${t.rate}, ${t.parameters.length} parameter(s)`));
    console.log('\n--- Summary ---');
    console.log(`Menu in this script    : ${MENU.length}`);
    console.log(`Already on the master  : ${skipped}`);
    console.log(`${dryRun ? 'Would add' : 'Added'}              : ${toCreate.length}`);
    console.log(`Tests on the master now: ${await test_model_1.LabTest.countDocuments({})}`);
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Seeding the test menu failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
