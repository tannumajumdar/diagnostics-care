"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Lists every registered patient against their unique UHID.
 *
 * The UHID is handed out at registration and never changes, so this is the
 * register to reach for when someone needs the whole roll at once - handing a
 * list to the front desk, reconciling against an older system, or checking
 * that a patient really is on the books before a bill is raised.
 *
 * Reads only. Nothing is written back to the database.
 *
 *   npm run list:patients                      # print the register
 *   npm run list:patients -- --status=Active   # only one status
 *   npm run list:patients -- --csv             # comma-separated, for a sheet
 *   npm run list:patients -- --csv > ids.csv   # save it
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const patient_model_1 = require("../models/patient.model");
dotenv_1.default.config();
const argValue = (name) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
};
const csvCell = (value) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const run = async () => {
    const asCsv = process.argv.includes('--csv');
    const status = argValue('status');
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(uri);
    if (!asCsv)
        console.log(`Connected to ${uri}\n`);
    const query = {};
    if (status)
        query.status = status;
    // Oldest first, so the list reads in the order the UHIDs were handed out.
    const patients = await patient_model_1.Patient.find(query)
        .sort({ registrationDate: 1 })
        .select('uhid patientName gender age mobile status registrationDate')
        .lean();
    const asDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '-';
    if (asCsv) {
        console.log('UHID,Patient Name,Gender,Age,Mobile,Status,Registered On');
        patients.forEach((p) => {
            console.log([p.uhid, p.patientName, p.gender, String(p.age), p.mobile, p.status, asDate(p.registrationDate)]
                .map((v) => csvCell(v ?? '-'))
                .join(','));
        });
    }
    else {
        const pad = (v, w) => v.padEnd(w).slice(0, w);
        console.log(`${pad('UHID', 20)}${pad('PATIENT NAME', 28)}${pad('GENDER', 14)}${pad('AGE', 5)}${pad('MOBILE', 14)}${pad('STATUS', 12)}REGISTERED`);
        console.log('-'.repeat(105));
        patients.forEach((p) => {
            console.log(`${pad(p.uhid ?? '-', 20)}${pad(p.patientName ?? '-', 28)}${pad(p.gender ?? '-', 14)}${pad(String(p.age ?? '-'), 5)}${pad(p.mobile ?? '-', 14)}${pad(p.status ?? '-', 12)}${asDate(p.registrationDate)}`);
        });
        console.log(`\nTotal patients${status ? ` (status: ${status})` : ''}: ${patients.length}`);
        // A UHID that is missing or shared would break billing and report lookup,
        // so say so here rather than letting it surface as a wrong report later.
        const missing = patients.filter((p) => !p.uhid);
        if (missing.length) {
            console.log(`\n${missing.length} patient(s) have NO UHID:`);
            missing.forEach((p) => console.log(`  - ${p.patientName} (${p._id})`));
        }
        const seen = new Map();
        patients.forEach((p) => p.uhid && seen.set(p.uhid, (seen.get(p.uhid) ?? 0) + 1));
        const duplicates = [...seen.entries()].filter(([, n]) => n > 1);
        if (duplicates.length) {
            console.log(`\n${duplicates.length} UHID(s) used more than once:`);
            duplicates.forEach(([uhid, n]) => console.log(`  - ${uhid} x${n}`));
        }
    }
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Listing failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
