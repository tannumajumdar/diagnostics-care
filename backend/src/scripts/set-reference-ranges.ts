/**
 * Fills in reference ranges - and age bands where the range moves with age -
 * for the tests that were created with only a placeholder line, and lays the
 * CBC out the way the lab's desktop parameter screen had it.
 *
 * Rows are written in the band layout the parameter master uses: one row per
 * PARAMETER FOR / age window, MIN / MAX instead of the old sex strings. Ages
 * are in days; a band with no upper age runs to 54750 days (150 years).
 *
 * Before anything is written, every test's current parameters are saved to
 * backups/parameters-<timestamp>.json, so a run can be undone.
 *
 * Run: npx ts-node --transpile-only src/scripts/set-reference-ranges.ts
 * Add --dry-run to print what would change without writing.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { LabTest } from '../models/test.model';

type Sex = 'ALL' | 'MALE' | 'FEMALE';

interface Band {
  name: string;
  min?: string;
  max?: string;
  unit?: string;
  sex?: Sex;
  from?: number;
  to?: number;
  type?: string;
  text?: string;
  method?: string;
  short?: string;
  critLow?: string;
  critHigh?: string;
}

// Age windows, in days.
const D = { week: 7, month: 30, y1: 365, y2: 730, y6: 2190, y12: 4380, y18: 6570 };

const header = (name: string): Band => ({ name, type: 'Header' });
const text = (name: string, normal: string, extra: Partial<Band> = {}): Band => ({ name, text: normal, type: 'Text', ...extra });
const posNeg = (name: string, extra: Partial<Band> = {}): Band => ({ name, text: 'Negative', type: 'Positive/Negative', ...extra });
const reactive = (name: string, extra: Partial<Band> = {}): Band => ({
  name,
  text: 'Non-Reactive',
  type: 'Reactive/Non-Reactive',
  ...extra,
});

/** Turns the bands into stored rows - one ORDER per parameter name. */
const toRows = (bands: Band[]) => {
  const order = new Map<string, number>();
  return bands.map((b) => {
    const key = b.name.toLowerCase();
    if (!order.has(key)) order.set(key, order.size + 1);
    return {
      parameterName: b.name,
      shortName: b.short || '',
      unit: b.unit || '',
      method: b.method || '',
      resultType: b.type || 'Numeric',
      displayOrder: order.get(key)!,
      paraFor: b.sex || 'ALL',
      minValue: b.min || '',
      maxValue: b.max || '',
      // HIGH / LOW RANGE follow MAX / MIN - a text or header line has none.
      highRange: b.max || '',
      lowRange: b.min || '',
      ageFromDays: b.from || 0,
      // No AGE TO means every age - written as 150 years, like the desktop screen.
      ageToDays: b.type === 'Header' ? 0 : b.to || 54750,
      referenceText: b.text || '',
      criticalLow: b.critLow || '',
      criticalHigh: b.critHigh || '',
      // Cleared so the sheet reads MIN / MAX, not the old strings.
      maleReferenceRange: '',
      femaleReferenceRange: '',
      childReferenceRange: '',
    };
  });
};

// ---------------------------------------------------------------- haematology

/** Haemoglobin by age and sex, as on the lab's desktop screen. */
const HB: Band[] = [
  { name: 'Haemoglobin (Hb)', short: 'Hb', unit: 'g/dL', min: '14.5', max: '22.5', from: 0, to: D.week, critLow: '7', critHigh: '20' },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', min: '9', max: '14', from: D.week + 1, to: D.y6 },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', min: '11', max: '15.5', from: D.y6 + 1, to: D.y12 },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', sex: 'FEMALE', min: '12', max: '16', from: D.y12 + 1, to: D.y18 },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', sex: 'MALE', min: '13', max: '16', from: D.y12 + 1, to: D.y18 },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', sex: 'FEMALE', min: '12', max: '16', from: D.y18 + 1 },
  { name: 'Haemoglobin (Hb)', unit: 'g/dL', sex: 'MALE', min: '13.5', max: '17.5', from: D.y18 + 1 },
];

const TLC: Band[] = [
  { name: 'Total Leucocyte Count (TLC)', short: 'TLC', unit: '/cumm', min: '9000', max: '30000', from: 0, to: D.week, critLow: '2000', critHigh: '30000' },
  { name: 'Total Leucocyte Count (TLC)', unit: '/cumm', min: '5000', max: '19500', from: D.week + 1, to: D.y2 },
  { name: 'Total Leucocyte Count (TLC)', unit: '/cumm', min: '5000', max: '15500', from: D.y2 + 1, to: D.y6 },
  { name: 'Total Leucocyte Count (TLC)', unit: '/cumm', min: '4500', max: '13500', from: D.y6 + 1, to: D.y12 },
  { name: 'Total Leucocyte Count (TLC)', unit: '/cumm', min: '4000', max: '11000', from: D.y12 + 1 },
];

const DLC: Band[] = [
  header('Differential Leucocyte Count'),
  { name: 'Neutrophils', unit: '%', min: '20', max: '50', from: 0, to: D.y6 },
  { name: 'Neutrophils', unit: '%', min: '40', max: '75', from: D.y6 + 1 },
  { name: 'Lymphocytes', unit: '%', min: '40', max: '70', from: 0, to: D.y6 },
  { name: 'Lymphocytes', unit: '%', min: '20', max: '45', from: D.y6 + 1 },
  { name: 'Monocytes', unit: '%', min: '2', max: '10' },
  { name: 'Eosinophils', unit: '%', min: '1', max: '6' },
  { name: 'Basophils', unit: '%', min: '0', max: '1' },
];

const PLATELET: Band[] = [
  { name: 'Platelet Count', short: 'PLT', unit: '/cumm', min: '150000', max: '450000', critLow: '20000', critHigh: '1000000' },
];

/** The CBC as the desktop screen laid it out - ranges from that screen. */
const CBC: Band[] = [
  ...HB,
  { name: 'Total RBC Count', short: 'RBC', unit: 'million/cumm', sex: 'MALE', min: '4.5', max: '5.9' },
  { name: 'Total RBC Count', unit: 'million/cumm', sex: 'FEMALE', min: '4.5', max: '5.1' },
  { name: 'Haematocrit (PCV)', short: 'PCV', unit: '%', sex: 'MALE', min: '41.5', max: '50.4' },
  { name: 'Haematocrit (PCV)', unit: '%', sex: 'FEMALE', min: '35.9', max: '44.6' },
  header('RBC Indices'),
  { name: 'MCV', unit: 'fL', min: '95', max: '121', from: 0, to: D.week },
  { name: 'MCV', unit: 'fL', min: '70', max: '86', from: D.week + 1, to: D.y2 },
  { name: 'MCV', unit: 'fL', min: '78', max: '96', from: D.y2 + 1 },
  { name: 'MCH', unit: 'pg', min: '31', max: '37', from: 0, to: D.week },
  { name: 'MCH', unit: 'pg', min: '28', max: '40', from: D.week + 1, to: D.month },
  { name: 'MCH', unit: 'pg', min: '27', max: '32', from: D.month + 1 },
  { name: 'MCHC', unit: 'g/dL', min: '28', max: '38', from: 0, to: 720 },
  { name: 'MCHC', unit: 'g/dL', min: '33', max: '37', from: 721 },
  { name: 'RDW-CV', unit: '%', min: '11', max: '16' },
  header('WBC'),
  ...TLC,
  ...DLC,
  header('Platelets'),
  ...PLATELET,
];

// ------------------------------------------------------------------- the rest

const RANGES: Record<string, Band[]> = {
  CBC001: CBC,
  'FBC-CBC': CBC,
  HB001: HB,
  TLC001: TLC,
  DLC001: DLC.slice(1),
  PLT001: PLATELET,

  AEC001: [{ name: 'Absolute Eosinophil Count', short: 'AEC', unit: '/cumm', min: '40', max: '440' }],
  RET001: [
    { name: 'Reticulocyte Count', unit: '%', min: '2', max: '6', from: 0, to: D.week },
    { name: 'Reticulocyte Count', unit: '%', min: '0.5', max: '2.5', from: D.week + 1 },
  ],
  PBS001: [
    text('RBC Morphology', 'Normocytic normochromic'),
    text('WBC Morphology', 'Normal in number and morphology'),
    text('Platelets', 'Adequate on smear'),
    text('Haemoparasites', 'Not seen'),
    text('Impression', ''),
  ],
  BTC001: [
    { name: 'Bleeding Time (BT)', short: 'BT', unit: 'min', min: '1', max: '5', method: 'Duke' },
    { name: 'Clotting Time (CT)', short: 'CT', unit: 'min', min: '4', max: '10', method: 'Capillary' },
  ],
  PTI001: [
    { name: 'Prothrombin Time (Patient)', short: 'PT', unit: 'sec', min: '11', max: '13.5' },
    { name: 'Prothrombin Time (Control)', unit: 'sec', min: '11', max: '13.5' },
    { name: 'INR', min: '0.8', max: '1.2', critHigh: '5' },
  ],
  APT001: [
    { name: 'APTT (Patient)', short: 'APTT', unit: 'sec', min: '25', max: '35' },
    { name: 'APTT (Control)', unit: 'sec', min: '25', max: '35' },
  ],

  ASO001: [{ name: 'ASO Titre', unit: 'IU/mL', max: '200', method: 'Latex agglutination' }],
  RAF001: [{ name: 'RA Factor', unit: 'IU/mL', max: '20', method: 'Latex agglutination' }],
  PSA001: [
    // The upper limit rises with age.
    { name: 'Total PSA', unit: 'ng/mL', sex: 'MALE', min: '0', max: '2.5', from: 0, to: 50 * 365 - 1, method: 'CLIA' },
    { name: 'Total PSA', unit: 'ng/mL', sex: 'MALE', min: '0', max: '3.5', from: 50 * 365, to: 60 * 365 - 1 },
    { name: 'Total PSA', unit: 'ng/mL', sex: 'MALE', min: '0', max: '4.5', from: 60 * 365, to: 70 * 365 - 1 },
    { name: 'Total PSA', unit: 'ng/mL', sex: 'MALE', min: '0', max: '6.5', from: 70 * 365 },
    { name: 'Total PSA', unit: 'ng/mL', min: '0', max: '4' },
  ],
  ALB001: [
    { name: 'Serum Albumin', unit: 'g/dL', min: '2.8', max: '4.4', from: 0, to: D.month },
    { name: 'Serum Albumin', unit: 'g/dL', min: '3.5', max: '5.2', from: D.month + 1 },
  ],
  AMY001: [{ name: 'Serum Amylase', unit: 'U/L', min: '28', max: '100' }],
  LPS001: [{ name: 'Serum Lipase', unit: 'U/L', min: '13', max: '60' }],
  BIL001: [
    { name: 'Total Bilirubin', unit: 'mg/dL', min: '0.3', max: '1.2' },
    { name: 'Direct Bilirubin', unit: 'mg/dL', min: '0', max: '0.3' },
    { name: 'Indirect Bilirubin', unit: 'mg/dL', min: '0.2', max: '0.9' },
  ],
  MAG001: [{ name: 'Serum Magnesium', unit: 'mg/dL', min: '1.6', max: '2.6' }],
  PHO001: [
    { name: 'Serum Phosphorus', unit: 'mg/dL', min: '4', max: '7', from: 0, to: D.y12 },
    { name: 'Serum Phosphorus', unit: 'mg/dL', min: '2.5', max: '4.5', from: D.y12 + 1 },
  ],
  IRN001: [
    { name: 'Serum Iron', unit: 'µg/dL', sex: 'MALE', min: '65', max: '175' },
    { name: 'Serum Iron', unit: 'µg/dL', sex: 'FEMALE', min: '50', max: '170' },
    { name: 'TIBC', unit: 'µg/dL', min: '250', max: '450' },
    { name: 'Transferrin Saturation', unit: '%', min: '20', max: '50' },
    { name: 'Serum Ferritin', unit: 'ng/mL', sex: 'MALE', min: '30', max: '400' },
    { name: 'Serum Ferritin', unit: 'ng/mL', sex: 'FEMALE', min: '13', max: '150' },
  ],
  GTT001: [
    { name: 'Fasting Blood Glucose', unit: 'mg/dL', min: '70', max: '100' },
    { name: 'Glucose - 1 Hour', unit: 'mg/dL', max: '180' },
    { name: 'Glucose - 2 Hours', unit: 'mg/dL', max: '140' },
  ],
  UMA001: [{ name: 'Urine Microalbumin', unit: 'mg/L', max: '30' }],

  TYP001: [posNeg('Typhidot IgM'), posNeg('Typhidot IgG')],
  VDR001: [reactive('VDRL / RPR')],
  AFB001: [text('AFB (Ziehl-Neelsen Stain)', 'Acid fast bacilli not seen')],
  STR001: [
    header('Physical Examination'),
    text('Colour', 'Brown'),
    text('Consistency', 'Formed'),
    text('Mucus', 'Absent'),
    text('Visible Blood', 'Absent'),
    header('Chemical Examination'),
    posNeg('Occult Blood'),
    header('Microscopic Examination'),
    text('Pus Cells', '0 - 2 /hpf'),
    text('Red Blood Cells', 'Nil'),
    text('Ova', 'Not seen'),
    text('Cysts', 'Not seen'),
  ],
  BCS001: [
    text('Specimen', 'Blood'),
    text('Organism Isolated', 'No growth after 5 days of incubation'),
    text('Antibiotic Sensitivity', ''),
  ],
  TSC001: [
    text('Specimen', 'Throat swab'),
    text('Organism Isolated', 'Normal commensal flora'),
    text('Antibiotic Sensitivity', ''),
  ],
  UCS001: [
    text('Specimen', 'Urine (midstream)'),
    text('Organism Isolated', 'No growth'),
    text('Colony Count', '< 10^4 CFU/mL'),
    text('Antibiotic Sensitivity', ''),
  ],
};

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

  let updated = 0;
  for (const [code, bands] of Object.entries(RANGES)) {
    const test = all.find((t: any) => t.testCode === code);
    if (!test) {
      console.log(`skip ${code} - no such test`);
      continue;
    }
    const rows = toRows(bands);
    console.log(`${dryRun ? '[dry] ' : ''}${code.padEnd(9)} ${test.testName} -> ${rows.length} rows`);
    if (!dryRun) {
      await LabTest.updateOne({ _id: test._id }, { $set: { parameters: rows } }, { runValidators: true });
      updated += 1;
    }
  }

  console.log(dryRun ? 'Dry run - nothing written.' : `Updated ${updated} tests.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
