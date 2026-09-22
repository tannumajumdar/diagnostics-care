/**
 * The Full Body Checkup menu, panel by panel.
 *
 * Sixteen panels, every parameter carrying the unit it is measured in, the
 * adult interval it is read against and the method it is run by - which is
 * what a report has to print beside a number for it to mean anything. Where
 * an interval differs by sex it is written twice, because the report picks
 * the band that matches the patient rather than printing both.
 *
 * These are the usual adult intervals and the methods a mid-sized centre
 * actually runs. They are a starting point, not gospel: a lab on a different
 * analyser edits the sheet on the test master and its edit wins from then on.
 * Nothing here is read at runtime - it is seed data, written once into the
 * catalogue by `npm run seed:checkup`.
 */

export type CheckupResultType =
  | 'Numeric'
  | 'Text'
  | 'Dropdown'
  | 'Positive/Negative'
  | 'Reactive/Non-Reactive'
  | 'Normal/Abnormal';

export interface CheckupParameter {
  parameterName: string;
  shortName?: string;
  unit?: string;
  maleReferenceRange?: string;
  femaleReferenceRange?: string;
  childReferenceRange?: string;
  criticalLow?: string;
  criticalHigh?: string;
  method?: string;
  resultType?: CheckupResultType;
}

export type CheckupDept = 'PATH' | 'BIO' | 'HEMA' | 'MICRO';

export interface CheckupPanel {
  testName: string;
  testCode: string;
  dept: CheckupDept;
  /** Usual small-centre figure; the centre tunes it under Rates. */
  rate: number;
  sampleType: string;
  sampleContainer: string;
  fasting?: boolean;
  tat?: string;
  parameters: CheckupParameter[];
}

/**
 * A measured parameter. `female` defaults to the male band, which is the
 * common case - only the parameters that genuinely differ carry two.
 */
const num = (
  parameterName: string,
  shortName: string,
  unit: string,
  male: string,
  female = male,
  method = '',
  extra: Partial<CheckupParameter> = {}
): CheckupParameter => ({
  parameterName,
  shortName,
  unit,
  maleReferenceRange: male,
  femaleReferenceRange: female,
  method,
  resultType: 'Numeric',
  ...extra,
});

/** A dipstick line: it reads Negative or it is a finding. */
const strip = (parameterName: string, shortName: string, method = 'Reagent strip'): CheckupParameter => ({
  parameterName,
  shortName,
  unit: '',
  maleReferenceRange: 'Negative',
  femaleReferenceRange: 'Negative',
  method,
  resultType: 'Positive/Negative',
});

const EDTA = { sampleType: 'Whole Blood', sampleContainer: 'EDTA Purple Top Vial' };
const SERUM = { sampleType: 'Serum', sampleContainer: 'Yellow Top (SST) Vial' };
const FLUORIDE = { sampleType: 'Plasma', sampleContainer: 'Grey Top (Fluoride) Vial' };
const CITRATE = { sampleType: 'Plasma', sampleContainer: 'Blue Top (Citrate) Vial' };
const URINE = { sampleType: 'Urine', sampleContainer: 'Sterile Urine Container' };
const ARTERIAL = { sampleType: 'Arterial Blood', sampleContainer: 'Heparinised ABG Syringe' };

export const CHECKUP_PANELS: CheckupPanel[] = [
  // ---------------------------------------------------------------- 1. CBC
  {
    testName: 'Complete Blood Count with Differential',
    testCode: 'FBC-CBC',
    dept: 'HEMA',
    rate: 400,
    ...EDTA,
    tat: '4 Hours',
    parameters: [
      num('Hemoglobin', 'Hb', 'g/dL', '13.2 - 16.6', '11.6 - 15.0', 'SLS-Hb photometry', {
        criticalLow: '7.0',
        criticalHigh: '20.0',
      }),
      num('RBC Count', 'RBC', '×10⁶/µL', '4.35 - 5.65', '3.92 - 5.13', 'Impedance / hydrodynamic focusing'),
      num('WBC Count', 'WBC', '×10³/µL', '3.4 - 9.6', '3.4 - 9.6', 'Flow cytometry / impedance', {
        criticalLow: '2.0',
        criticalHigh: '30.0',
      }),
      num('Platelet Count', 'PLT', '×10³/µL', '135 - 317', '157 - 371', 'Impedance / optical', {
        criticalLow: '50',
        criticalHigh: '1000',
      }),
      num('Hematocrit', 'HCT', '%', '38.3 - 48.6', '35.5 - 44.9', 'Calculated'),
      num('MCV', 'MCV', 'fL', '78 - 98', '78 - 98', 'Calculated'),
      num('MCH', 'MCH', 'pg', '27 - 33', '27 - 33', 'Calculated'),
      num('MCHC', 'MCHC', 'g/dL', '32 - 36', '32 - 36', 'Calculated'),
      num('RDW', 'RDW', '%', '11.5 - 14.5', '11.5 - 14.5', 'Calculated'),
      num('Neutrophils', 'N', '%', '40 - 75', '40 - 75', 'Flow cytometry'),
      num('Lymphocytes', 'L', '%', '20 - 40', '20 - 40', 'Flow cytometry'),
      num('Monocytes', 'M', '%', '2 - 10', '2 - 10', 'Flow cytometry'),
      num('Eosinophils', 'E', '%', '0 - 6', '0 - 6', 'Flow cytometry'),
      num('Basophils', 'B', '%', '0 - 1', '0 - 1', 'Flow cytometry'),
    ],
  },

  // ----------------------------------------------------------- 2. Diabetes
  {
    testName: 'Diabetes Panel',
    testCode: 'FBC-DIA',
    dept: 'BIO',
    rate: 1200,
    ...FLUORIDE,
    fasting: true,
    tat: '8 Hours',
    parameters: [
      num('Fasting Glucose', 'FBS', 'mg/dL', '70 - 99', '70 - 99', 'Hexokinase / enzymatic', {
        criticalLow: '50',
        criticalHigh: '400',
      }),
      num('Random Glucose', 'RBS', 'mg/dL', '70 - 140', '70 - 140', 'Hexokinase', {
        criticalLow: '50',
        criticalHigh: '400',
      }),
      num('HbA1c', 'HbA1c', '%', '< 5.7', '< 5.7', 'HPLC / immunoassay', { criticalHigh: '10.0' }),
      num('Insulin (Fasting)', 'INS', 'µIU/mL', '2 - 25', '2 - 25', 'Chemiluminescent immunoassay'),
      num('C-Peptide', 'CPEP', 'ng/mL', '1.1 - 4.4', '1.1 - 4.4', 'Immunoassay'),
      num('Fructosamine', 'FRUC', 'µmol/L', '200 - 285', '200 - 285', 'Colorimetric'),
    ],
  },

  // -------------------------------------------------------------- 3. Renal
  {
    testName: 'Kidney Function Test (KFT)',
    testCode: 'FBC-KFT',
    dept: 'BIO',
    rate: 900,
    ...SERUM,
    tat: '8 Hours',
    parameters: [
      num('Urea', 'UREA', 'mg/dL', '15 - 45', '15 - 45', 'Urease / GLDH'),
      num('Blood Urea Nitrogen', 'BUN', 'mg/dL', '8 - 24', '8 - 24', 'Urease / GLDH'),
      num('Creatinine', 'CREA', 'mg/dL', '0.74 - 1.35', '0.59 - 1.04', 'Enzymatic / Jaffe', {
        criticalHigh: '5.0',
      }),
      num('eGFR', 'eGFR', 'mL/min/1.73m²', '≥ 60', '≥ 60', 'Calculated'),
      num('Uric Acid', 'UA', 'mg/dL', '3.4 - 7.0', '2.4 - 6.0', 'Uricase'),
      num('Sodium', 'Na', 'mmol/L', '135 - 145', '135 - 145', 'ISE', {
        criticalLow: '120',
        criticalHigh: '160',
      }),
      num('Potassium', 'K', 'mmol/L', '3.6 - 5.2', '3.6 - 5.2', 'ISE', {
        criticalLow: '2.5',
        criticalHigh: '6.5',
      }),
      num('Chloride', 'Cl', 'mmol/L', '98 - 107', '98 - 107', 'ISE'),
      num('Bicarbonate', 'HCO3', 'mmol/L', '22 - 29', '22 - 29', 'Photometric / electrode'),
      num('Calcium', 'Ca', 'mg/dL', '8.6 - 10.0', '8.6 - 10.0', 'Colorimetric'),
      num('Phosphorus', 'PHOS', 'mg/dL', '2.5 - 4.5', '2.5 - 4.5', 'Phosphomolybdate'),
      num('Magnesium', 'Mg', 'mg/dL', '1.7 - 2.2', '1.7 - 2.2', 'Colorimetric'),
    ],
  },

  // -------------------------------------------------------------- 4. Liver
  {
    testName: 'Liver Function Test (LFT)',
    testCode: 'FBC-LFT',
    dept: 'BIO',
    rate: 800,
    ...SERUM,
    tat: '8 Hours',
    parameters: [
      num('Total Bilirubin', 'TBIL', 'mg/dL', '0.0 - 1.2', '0.0 - 1.2', 'Diazo / colorimetric', {
        criticalHigh: '15.0',
      }),
      num('Direct Bilirubin', 'DBIL', 'mg/dL', '0.0 - 0.3', '0.0 - 0.3', 'Diazo / colorimetric'),
      num('AST (SGOT)', 'AST', 'U/L', '8 - 48', '8 - 48', 'IFCC / photometric'),
      num('ALT (SGPT)', 'ALT', 'U/L', '7 - 55', '7 - 45', 'IFCC / photometric'),
      num('Alkaline Phosphatase', 'ALP', 'U/L', '40 - 129', '35 - 104', 'Colorimetric'),
      num('GGT', 'GGT', 'U/L', '9 - 48', '6 - 42', 'Enzymatic'),
      num('Total Protein', 'TP', 'g/dL', '6.3 - 7.9', '6.3 - 7.9', 'Biuret'),
      num('Albumin', 'ALB', 'g/dL', '3.5 - 5.0', '3.5 - 5.0', 'Bromocresol green/purple'),
      num('Globulin', 'GLOB', 'g/dL', '2.0 - 3.5', '2.0 - 3.5', 'Calculated'),
      num('A/G Ratio', 'A/G', 'ratio', '1.0 - 2.5', '1.0 - 2.5', 'Calculated'),
    ],
  },

  // -------------------------------------------------------------- 5. Lipid
  {
    testName: 'Lipid Profile',
    testCode: 'FBC-LIP',
    dept: 'BIO',
    rate: 700,
    ...SERUM,
    fasting: true,
    tat: '8 Hours',
    parameters: [
      num('Total Cholesterol', 'CHOL', 'mg/dL', '< 200', '< 200', 'Enzymatic colorimetric'),
      num('LDL Cholesterol', 'LDL', 'mg/dL', '< 100', '< 100', 'Calculated / direct'),
      num('HDL Cholesterol', 'HDL', 'mg/dL', '≥ 40', '≥ 50', 'Direct enzymatic'),
      num('Triglycerides', 'TG', 'mg/dL', '< 150', '< 150', 'Enzymatic colorimetric'),
      num('VLDL Cholesterol', 'VLDL', 'mg/dL', '5 - 30', '5 - 30', 'Calculated'),
      num('Non-HDL Cholesterol', 'Non-HDL', 'mg/dL', '< 130', '< 130', 'Calculated'),
    ],
  },

  // ------------------------------------------------------------ 6. Thyroid
  {
    testName: 'Thyroid Profile (Complete)',
    testCode: 'FBC-THY',
    dept: 'BIO',
    rate: 1100,
    ...SERUM,
    tat: '24 Hours',
    parameters: [
      num('TSH', 'TSH', 'mIU/L', '0.3 - 4.2', '0.3 - 4.2', 'Chemiluminescent immunoassay'),
      num('Free T4', 'FT4', 'ng/dL', '0.8 - 1.8', '0.8 - 1.8', 'Immunoassay'),
      num('Free T3', 'FT3', 'pg/mL', '2.3 - 4.2', '2.3 - 4.2', 'Immunoassay'),
      num('Total T3', 'T3', 'ng/dL', '80 - 200', '80 - 200', 'Immunoassay'),
      num('Total T4', 'T4', 'µg/dL', '5 - 12', '5 - 12', 'Immunoassay'),
      num('Anti-TPO', 'TPO', 'IU/mL', '< 35', '< 35', 'Immunoassay'),
      num('Anti-Thyroglobulin', 'Anti-Tg', 'IU/mL', 'Lab-specific', 'Lab-specific', 'Immunoassay'),
    ],
  },

  // -------------------------------------------------------- 7. Iron studies
  {
    testName: 'Iron Studies',
    testCode: 'FBC-IRON',
    dept: 'BIO',
    rate: 1300,
    ...SERUM,
    fasting: true,
    tat: '24 Hours',
    parameters: [
      num('Serum Iron', 'FE', 'µg/dL', '65 - 175', '50 - 170', 'Colorimetric'),
      num('Ferritin', 'FERR', 'ng/mL', '30 - 400', '15 - 150', 'Chemiluminescent immunoassay'),
      num('TIBC', 'TIBC', 'µg/dL', '240 - 450', '240 - 450', 'Colorimetric'),
      num('Transferrin', 'TRF', 'mg/dL', '200 - 360', '200 - 360', 'Immunoturbidimetric'),
      num('Transferrin Saturation', 'TSAT', '%', '20 - 50', '20 - 50', 'Calculated'),
    ],
  },

  // ----------------------------------------------------------- 8. Vitamins
  {
    testName: 'Vitamin Profile',
    testCode: 'FBC-VIT',
    dept: 'BIO',
    rate: 3500,
    ...SERUM,
    tat: '48 Hours',
    parameters: [
      num('Vitamin B12', 'B12', 'pg/mL', '200 - 900', '200 - 900', 'Chemiluminescent immunoassay'),
      num('Folate', 'FOL', 'ng/mL', '> 4', '> 4', 'Immunoassay'),
      num('25-OH Vitamin D', 'VIT D', 'ng/mL', '20 - 50', '20 - 50', 'Immunoassay / LC-MS/MS'),
      num('Vitamin A', 'VIT A', 'µg/dL', '20 - 60', '20 - 60', 'HPLC'),
      num('Vitamin B6', 'VIT B6', 'µg/L', 'Lab-specific', 'Lab-specific', 'HPLC'),
      num('Vitamin E', 'VIT E', 'mg/L', '5.5 - 17', '5.5 - 17', 'HPLC'),
      num('Vitamin C', 'VIT C', 'mg/dL', '0.4 - 2.0', '0.4 - 2.0', 'HPLC'),
    ],
  },

  // ------------------------------------------------------- 9. Urine routine
  {
    testName: 'Urine Routine & Microscopy',
    testCode: 'FBC-URINE',
    dept: 'PATH',
    rate: 250,
    ...URINE,
    tat: '4 Hours',
    parameters: [
      {
        parameterName: 'Appearance',
        shortName: 'APP',
        unit: '',
        maleReferenceRange: 'Clear',
        femaleReferenceRange: 'Clear',
        method: 'Visual / automated',
        resultType: 'Text',
      },
      {
        parameterName: 'Color',
        shortName: 'COL',
        unit: '',
        maleReferenceRange: 'Pale yellow - yellow',
        femaleReferenceRange: 'Pale yellow - yellow',
        method: 'Visual',
        resultType: 'Text',
      },
      num('pH', 'pH', 'pH', '4.5 - 8.0', '4.5 - 8.0', 'Reagent strip'),
      num('Specific Gravity', 'SG', '', '1.005 - 1.030', '1.005 - 1.030', 'Refractometry'),
      strip('Protein', 'PROT', 'Dipstick'),
      strip('Glucose', 'GLU', 'Dipstick'),
      strip('Ketones', 'KET', 'Dipstick'),
      strip('Blood', 'BLD', 'Dipstick'),
      strip('Bilirubin', 'BIL', 'Dipstick'),
      strip('Nitrite', 'NIT', 'Dipstick'),
      strip('Leukocyte Esterase', 'LEU', 'Dipstick'),
      num('RBC', 'RBC', '/HPF', '0 - 2', '0 - 2', 'Microscopy / automated'),
      num('WBC', 'WBC', '/HPF', '0 - 5', '0 - 5', 'Microscopy / automated'),
    ],
  },

  // ------------------------------------------------- 10. Inflammatory markers
  {
    testName: 'Inflammatory Markers',
    testCode: 'FBC-INFL',
    dept: 'BIO',
    rate: 900,
    ...SERUM,
    tat: '8 Hours',
    parameters: [
      num('CRP', 'CRP', 'mg/L', '< 5', '< 5', 'Immunoturbidimetry'),
      num('hs-CRP', 'hsCRP', 'mg/L', 'Risk-band specific', 'Risk-band specific', 'Immunoturbidimetry'),
      num('ESR', 'ESR', 'mm/hr', '0 - 15', '0 - 20', 'Westergren / automated'),
      num('Procalcitonin', 'PCT', 'ng/mL', '< 0.05', '< 0.05', 'Chemiluminescent immunoassay'),
    ],
  },

  // ------------------------------------------------------------ 11. Cardiac
  {
    testName: 'Cardiac Markers',
    testCode: 'FBC-CARD',
    dept: 'BIO',
    rate: 2200,
    ...SERUM,
    tat: '4 Hours',
    parameters: [
      num('Troponin I', 'TnI', 'ng/L', 'Assay-specific', 'Assay-specific', 'Chemiluminescent immunoassay'),
      num('Troponin T', 'TnT', 'ng/L', 'Assay-specific', 'Assay-specific', 'Electrochemiluminescence'),
      num('CK-MB', 'CKMB', 'ng/mL', '0 - 5', '0 - 5', 'Immunoassay'),
      num('Total CK', 'CK', 'U/L', '39 - 308', '26 - 192', 'Enzymatic'),
      num('BNP', 'BNP', 'pg/mL', '< 100', '< 100', 'Immunoassay'),
      num('NT-proBNP', 'NT-proBNP', 'pg/mL', 'Age-dependent', 'Age-dependent', 'Electrochemiluminescence'),
    ],
  },

  // --------------------------------------------------------- 12. Pancreatic
  {
    testName: 'Pancreatic Profile',
    testCode: 'FBC-PANC',
    dept: 'BIO',
    rate: 800,
    ...SERUM,
    fasting: true,
    tat: '8 Hours',
    parameters: [
      num('Amylase', 'AMY', 'U/L', '30 - 110', '30 - 110', 'Enzymatic'),
      num('Lipase', 'LIP', 'U/L', '13 - 60', '13 - 60', 'Enzymatic colorimetric'),
      num('Glucose (Fasting)', 'GLU', 'mg/dL', '70 - 99', '70 - 99', 'Hexokinase'),
    ],
  },

  // -------------------------------------------------------- 13. Electrolytes
  {
    testName: 'Serum Electrolytes (Extended)',
    testCode: 'FBC-ELEC',
    dept: 'BIO',
    rate: 700,
    ...SERUM,
    tat: '4 Hours',
    parameters: [
      num('Sodium', 'Na', 'mmol/L', '135 - 145', '135 - 145', 'ISE', {
        criticalLow: '120',
        criticalHigh: '160',
      }),
      num('Potassium', 'K', 'mmol/L', '3.6 - 5.2', '3.6 - 5.2', 'ISE', {
        criticalLow: '2.5',
        criticalHigh: '6.5',
      }),
      num('Chloride', 'Cl', 'mmol/L', '98 - 107', '98 - 107', 'ISE'),
      num('Bicarbonate', 'HCO3', 'mmol/L', '22 - 29', '22 - 29', 'Photometric'),
      num('Calcium', 'Ca', 'mg/dL', '8.6 - 10.0', '8.6 - 10.0', 'Colorimetric'),
      num('Ionized Calcium', 'iCa', 'mg/dL', '4.5 - 5.6', '4.5 - 5.6', 'Ion-selective electrode'),
      num('Magnesium', 'Mg', 'mg/dL', '1.7 - 2.2', '1.7 - 2.2', 'Colorimetric'),
      num('Phosphorus', 'PHOS', 'mg/dL', '2.5 - 4.5', '2.5 - 4.5', 'Colorimetric'),
    ],
  },

  // ----------------------------------------------------------- 14. Hormones
  {
    testName: 'Hormone Profile',
    testCode: 'FBC-HORM',
    dept: 'BIO',
    rate: 4500,
    ...SERUM,
    fasting: true,
    tat: '48 Hours',
    parameters: [
      num('Cortisol (8 AM)', 'CORT', 'µg/dL', '5 - 25', '5 - 25', 'Chemiluminescent immunoassay'),
      num('ACTH', 'ACTH', 'pg/mL', '10 - 60', '10 - 60', 'Immunoassay'),
      num('Prolactin', 'PRL', 'ng/mL', '4 - 15', '4 - 23', 'Immunoassay'),
      num('LH', 'LH', 'mIU/mL', 'Sex / cycle dependent', 'Sex / cycle dependent', 'Immunoassay'),
      num('FSH', 'FSH', 'mIU/mL', 'Sex / cycle dependent', 'Sex / cycle dependent', 'Immunoassay'),
      num('Testosterone', 'TESTO', 'ng/dL', '300 - 1000', 'Sex-specific', 'Immunoassay / LC-MS/MS'),
      num('Estradiol', 'E2', 'pg/mL', 'Sex / cycle dependent', 'Sex / cycle dependent', 'Immunoassay / LC-MS/MS'),
      num('Progesterone', 'PROG', 'ng/mL', 'Cycle dependent', 'Cycle dependent', 'Immunoassay'),
      num('PTH', 'PTH', 'pg/mL', '15 - 65', '15 - 65', 'Immunoassay'),
    ],
  },

  // -------------------------------------------------------- 15. Coagulation
  {
    testName: 'Coagulation Profile',
    testCode: 'FBC-COAG',
    dept: 'HEMA',
    rate: 1200,
    ...CITRATE,
    tat: '8 Hours',
    parameters: [
      num('PT', 'PT', 'seconds', '11 - 14', '11 - 14', 'Mechanical / optical clot detection'),
      num('INR', 'INR', 'ratio', '0.8 - 1.2', '0.8 - 1.2', 'Calculated', { criticalHigh: '5.0' }),
      num('aPTT', 'aPTT', 'seconds', '25 - 35', '25 - 35', 'Mechanical / optical clot detection'),
      num('Fibrinogen', 'FIB', 'mg/dL', '200 - 400', '200 - 400', 'Clauss method'),
      num('D-Dimer', 'DDIM', 'µg/mL FEU', '< 0.50', '< 0.50', 'Immunoturbidimetric'),
    ],
  },

  // ---------------------------------------------------------------- 16. ABG
  {
    testName: 'Arterial Blood Gas (ABG)',
    testCode: 'FBC-ABG',
    dept: 'BIO',
    rate: 1500,
    ...ARTERIAL,
    tat: '1 Hour',
    parameters: [
      num('pH', 'pH', '', '7.35 - 7.45', '7.35 - 7.45', 'Electrochemical', {
        criticalLow: '7.20',
        criticalHigh: '7.60',
      }),
      num('pCO₂', 'pCO2', 'mmHg', '35 - 45', '35 - 45', 'Potentiometric'),
      num('pO₂', 'pO2', 'mmHg', '80 - 100', '80 - 100', 'Amperometric', { criticalLow: '50' }),
      num('HCO₃⁻', 'HCO3', 'mmol/L', '22 - 26', '22 - 26', 'Calculated'),
      num('O₂ Saturation', 'SaO2', '%', '95 - 100', '95 - 100', 'Calculated / co-oximetry'),
      num('Lactate', 'LACT', 'mmol/L', '0.5 - 2.2', '0.5 - 2.2', 'Amperometric', { criticalHigh: '4.0' }),
    ],
  },
];

/** What the whole checkup comes to if every panel is billed one by one. */
export const CHECKUP_LIST_TOTAL = CHECKUP_PANELS.reduce((sum, panel) => sum + panel.rate, 0);

/**
 * The package the centre actually sells. The panels above stay ordinary
 * catalogue tests - drawn, run and reported one by one - and this only
 * decides what the whole set costs.
 */
export const CHECKUP_PACKAGE = {
  packageName: 'Full Body Checkup (Comprehensive)',
  packageCode: 'FBC-FULL',
  description:
    'Comprehensive annual health check - haematology, diabetes, kidney, liver, lipid, thyroid, iron, ' +
    'vitamins, urine, inflammatory, cardiac, pancreatic, electrolytes, hormones, coagulation and blood gas.',
  /** Round figure the counter quotes; edit it on the package master. */
  rate: 14000,
  /** Printed on the referring doctor's copy. 0 falls back to per-test rates. */
  referralRate: 16500,
  discountAllowed: false,
};
