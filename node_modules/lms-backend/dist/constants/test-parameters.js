"use strict";
/**
 * The parameter sheet behind every test on the menu.
 *
 * A test is only half a test without the lines that get measured - a bill for
 * "Lipid Profile" means nothing to the bench until it knows it owes a
 * cholesterol, a triglyceride and two HDL/LDL numbers. Tests are created at the
 * master screen where the desk rarely stops to type twelve parameters, so this
 * catalogue fills them in from the test's own name, and the same lookup backs
 * up result entry when a test in the database was created before it existed.
 *
 * Reference ranges are the usual adult Indian lab intervals. They are a
 * starting point, not gospel - a lab that runs a different method edits them on
 * the test master and its edit wins from then on.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parametersForTest = exports.findParameterTemplate = void 0;
const num = (parameterName, shortName, unit, male, female = male, extra = {}) => ({
    parameterName,
    shortName,
    unit,
    maleReferenceRange: male,
    femaleReferenceRange: female,
    resultType: 'Numeric',
    ...extra,
});
const qualitative = (parameterName, shortName, resultType, method = '') => ({
    parameterName,
    shortName,
    unit: '',
    maleReferenceRange: resultType === 'Reactive/Non-Reactive' ? 'Non-Reactive' : 'Negative',
    femaleReferenceRange: resultType === 'Reactive/Non-Reactive' ? 'Non-Reactive' : 'Negative',
    method,
    resultType,
});
/**
 * The matcher takes the highest-priority entry that matched, breaking ties on
 * the longest matching keyword - so "fasting blood sugar" lands on FBS rather
 * than on a stray "blood" in a haematology entry.
 */
const CATALOGUE = [
    {
        keywords: ['complete blood count', 'cbc', 'haemogram', 'hemogram'],
        parameters: [
            num('Hemoglobin (Hb)', 'Hb', 'g/dL', '13.0 - 17.0', '12.0 - 15.0', {
                childReferenceRange: '11.0 - 14.0',
                criticalLow: '7.0',
                criticalHigh: '20.0',
                method: 'Spectrophotometry',
            }),
            num('Total Leukocyte Count (TLC)', 'TLC', 'cells/cumm', '4000 - 11000', '4000 - 11000', {
                criticalLow: '2000',
                criticalHigh: '30000',
                method: 'Impedance',
            }),
            num('Red Blood Cell Count (RBC)', 'RBC', 'million/cumm', '4.5 - 5.5', '3.8 - 4.8', {
                method: 'Impedance',
            }),
            num('Platelet Count', 'PLT', 'lakhs/cumm', '1.5 - 4.5', '1.5 - 4.5', {
                criticalLow: '0.5',
                criticalHigh: '10.0',
                method: 'Impedance',
            }),
            num('Packed Cell Volume (PCV)', 'PCV', '%', '40 - 50', '36 - 46', { method: 'Calculated' }),
            num('MCV', 'MCV', 'fL', '83 - 101', '83 - 101', { method: 'Calculated' }),
            num('MCH', 'MCH', 'pg', '27 - 32', '27 - 32', { method: 'Calculated' }),
            num('MCHC', 'MCHC', 'g/dL', '31.5 - 34.5', '31.5 - 34.5', { method: 'Calculated' }),
            num('Neutrophils', 'N', '%', '40 - 80', '40 - 80', { method: 'Microscopy / Flow' }),
            num('Lymphocytes', 'L', '%', '20 - 40', '20 - 40', { method: 'Microscopy / Flow' }),
            num('Eosinophils', 'E', '%', '1 - 6', '1 - 6', { method: 'Microscopy / Flow' }),
            num('Monocytes', 'M', '%', '2 - 10', '2 - 10', { method: 'Microscopy / Flow' }),
            num('Basophils', 'B', '%', '0 - 2', '0 - 2', { method: 'Microscopy / Flow' }),
        ],
    },
    {
        keywords: ['erythrocyte sedimentation', 'esr'],
        parameters: [
            num('Erythrocyte Sedimentation Rate', 'ESR', 'mm/hr', '0 - 15', '0 - 20', {
                method: 'Westergren',
            }),
        ],
    },
    {
        keywords: ['blood group', 'abo', 'rh typing'],
        parameters: [
            {
                parameterName: 'ABO Blood Group',
                shortName: 'ABO',
                unit: '',
                maleReferenceRange: '-',
                femaleReferenceRange: '-',
                method: 'Slide & Tube Agglutination',
                resultType: 'Dropdown',
                dropdownOptions: ['A', 'B', 'AB', 'O'],
            },
            {
                parameterName: 'Rh (D) Typing',
                shortName: 'Rh',
                unit: '',
                maleReferenceRange: '-',
                femaleReferenceRange: '-',
                method: 'Slide & Tube Agglutination',
                resultType: 'Dropdown',
                dropdownOptions: ['Positive', 'Negative'],
            },
        ],
    },
    {
        keywords: ['fasting blood sugar', 'fasting blood glucose', 'fbs', 'fbg'],
        parameters: [
            num('Fasting Blood Glucose', 'FBS', 'mg/dL', '70 - 99', '70 - 99', {
                criticalLow: '50',
                criticalHigh: '400',
                method: 'GOD-POD',
            }),
        ],
    },
    {
        keywords: ['post prandial', 'postprandial', 'pp blood sugar', 'ppbs'],
        parameters: [
            num('Post Prandial Blood Glucose', 'PPBS', 'mg/dL', '70 - 140', '70 - 140', {
                criticalHigh: '400',
                method: 'GOD-POD',
            }),
        ],
    },
    {
        keywords: ['random blood sugar', 'rbs'],
        parameters: [
            num('Random Blood Glucose', 'RBS', 'mg/dL', '70 - 140', '70 - 140', {
                criticalLow: '50',
                criticalHigh: '400',
                method: 'GOD-POD',
            }),
        ],
    },
    {
        keywords: ['hba1c', 'glycated', 'glycosylated'],
        parameters: [
            num('HbA1c', 'HbA1c', '%', '4.0 - 5.6', '4.0 - 5.6', {
                criticalHigh: '10.0',
                method: 'HPLC',
            }),
            num('Estimated Average Glucose', 'eAG', 'mg/dL', '70 - 114', '70 - 114', {
                method: 'Calculated',
            }),
        ],
    },
    {
        keywords: ['lipid'],
        parameters: [
            num('Total Cholesterol', 'CHOL', 'mg/dL', '< 200', '< 200', { method: 'CHOD-PAP' }),
            num('Triglycerides', 'TG', 'mg/dL', '< 150', '< 150', { method: 'GPO-PAP' }),
            num('HDL Cholesterol', 'HDL', 'mg/dL', '> 40', '> 50', { method: 'Direct' }),
            num('LDL Cholesterol', 'LDL', 'mg/dL', '< 100', '< 100', { method: 'Calculated' }),
            num('VLDL Cholesterol', 'VLDL', 'mg/dL', '6 - 38', '6 - 38', { method: 'Calculated' }),
            num('Total Cholesterol / HDL Ratio', 'CHOL/HDL', 'Ratio', '< 4.5', '< 4.5', {
                method: 'Calculated',
            }),
        ],
    },
    {
        keywords: ['liver function', 'lft'],
        parameters: [
            num('Total Bilirubin', 'T.BIL', 'mg/dL', '0.2 - 1.2', '0.2 - 1.2', {
                criticalHigh: '15.0',
                method: 'Diazo',
            }),
            num('Direct Bilirubin', 'D.BIL', 'mg/dL', '0.0 - 0.3', '0.0 - 0.3', { method: 'Diazo' }),
            num('Indirect Bilirubin', 'I.BIL', 'mg/dL', '0.1 - 1.0', '0.1 - 1.0', { method: 'Calculated' }),
            num('SGPT (ALT)', 'ALT', 'U/L', '10 - 49', '10 - 36', { method: 'IFCC' }),
            num('SGOT (AST)', 'AST', 'U/L', '10 - 40', '10 - 35', { method: 'IFCC' }),
            num('Alkaline Phosphatase', 'ALP', 'U/L', '40 - 129', '35 - 104', { method: 'IFCC' }),
            num('Total Protein', 'TP', 'g/dL', '6.4 - 8.3', '6.4 - 8.3', { method: 'Biuret' }),
            num('Albumin', 'ALB', 'g/dL', '3.5 - 5.2', '3.5 - 5.2', { method: 'BCG' }),
            num('Globulin', 'GLB', 'g/dL', '2.0 - 3.5', '2.0 - 3.5', { method: 'Calculated' }),
            num('A/G Ratio', 'A/G', 'Ratio', '1.0 - 2.1', '1.0 - 2.1', { method: 'Calculated' }),
        ],
    },
    {
        keywords: ['kidney function', 'renal function', 'kft', 'rft'],
        parameters: [
            num('Blood Urea', 'UREA', 'mg/dL', '17 - 43', '17 - 43', {
                criticalHigh: '150',
                method: 'Urease-GLDH',
            }),
            num('Serum Creatinine', 'CREA', 'mg/dL', '0.7 - 1.3', '0.6 - 1.1', {
                criticalHigh: '8.0',
                method: 'Jaffe Kinetic',
            }),
            num('Blood Urea Nitrogen', 'BUN', 'mg/dL', '8 - 20', '8 - 20', { method: 'Calculated' }),
            num('Uric Acid', 'UA', 'mg/dL', '3.5 - 7.2', '2.6 - 6.0', { method: 'Uricase' }),
            num('Serum Sodium', 'Na', 'mmol/L', '136 - 145', '136 - 145', {
                criticalLow: '120',
                criticalHigh: '160',
                method: 'ISE',
            }),
            num('Serum Potassium', 'K', 'mmol/L', '3.5 - 5.1', '3.5 - 5.1', {
                criticalLow: '2.5',
                criticalHigh: '6.5',
                method: 'ISE',
            }),
            num('Serum Chloride', 'Cl', 'mmol/L', '98 - 107', '98 - 107', { method: 'ISE' }),
        ],
    },
    {
        keywords: ['thyroid', 'tft', 't3 t4 tsh'],
        parameters: [
            num('Triiodothyronine (T3)', 'T3', 'ng/dL', '80 - 200', '80 - 200', { method: 'CLIA' }),
            num('Thyroxine (T4)', 'T4', 'ug/dL', '4.8 - 12.7', '4.8 - 12.7', { method: 'CLIA' }),
            num('Thyroid Stimulating Hormone', 'TSH', 'uIU/mL', '0.35 - 5.50', '0.35 - 5.50', {
                criticalHigh: '20.0',
                method: 'CLIA',
            }),
        ],
    },
    {
        keywords: ['serum electrolyte', 'electrolyte'],
        parameters: [
            num('Serum Sodium', 'Na', 'mmol/L', '136 - 145', '136 - 145', {
                criticalLow: '120',
                criticalHigh: '160',
                method: 'ISE',
            }),
            num('Serum Potassium', 'K', 'mmol/L', '3.5 - 5.1', '3.5 - 5.1', {
                criticalLow: '2.5',
                criticalHigh: '6.5',
                method: 'ISE',
            }),
            num('Serum Chloride', 'Cl', 'mmol/L', '98 - 107', '98 - 107', { method: 'ISE' }),
        ],
    },
    {
        keywords: ['urine routine', 'urine analysis', 'urine r/m', 'urine examination'],
        parameters: [
            {
                parameterName: 'Colour',
                shortName: 'Colour',
                unit: '',
                maleReferenceRange: 'Pale Yellow',
                femaleReferenceRange: 'Pale Yellow',
                method: 'Visual',
                resultType: 'Text',
            },
            {
                parameterName: 'Appearance',
                shortName: 'Appearance',
                unit: '',
                maleReferenceRange: 'Clear',
                femaleReferenceRange: 'Clear',
                method: 'Visual',
                resultType: 'Text',
            },
            num('pH', 'pH', '', '5.0 - 8.0', '5.0 - 8.0', { method: 'Dipstick' }),
            num('Specific Gravity', 'Sp. Gr.', '', '1.005 - 1.030', '1.005 - 1.030', { method: 'Dipstick' }),
            qualitative('Urine Protein', 'Protein', 'Positive/Negative', 'Dipstick'),
            qualitative('Urine Glucose', 'Glucose', 'Positive/Negative', 'Dipstick'),
            qualitative('Ketone Bodies', 'Ketones', 'Positive/Negative', 'Dipstick'),
            num('Pus Cells (WBC)', 'Pus Cells', '/hpf', '0 - 5', '0 - 5', { method: 'Microscopy' }),
            num('Epithelial Cells', 'Epi. Cells', '/hpf', '0 - 5', '0 - 5', { method: 'Microscopy' }),
            num('RBCs', 'RBC', '/hpf', '0 - 2', '0 - 2', { method: 'Microscopy' }),
        ],
    },
    {
        keywords: ['widal', 'typhoid'],
        parameters: [
            {
                parameterName: 'S. Typhi "O"',
                shortName: 'TO',
                unit: 'Titre',
                maleReferenceRange: '< 1:80',
                femaleReferenceRange: '< 1:80',
                method: 'Slide Agglutination',
                resultType: 'Text',
            },
            {
                parameterName: 'S. Typhi "H"',
                shortName: 'TH',
                unit: 'Titre',
                maleReferenceRange: '< 1:80',
                femaleReferenceRange: '< 1:80',
                method: 'Slide Agglutination',
                resultType: 'Text',
            },
            {
                parameterName: 'S. Paratyphi "AH"',
                shortName: 'AH',
                unit: 'Titre',
                maleReferenceRange: '< 1:80',
                femaleReferenceRange: '< 1:80',
                method: 'Slide Agglutination',
                resultType: 'Text',
            },
            {
                parameterName: 'S. Paratyphi "BH"',
                shortName: 'BH',
                unit: 'Titre',
                maleReferenceRange: '< 1:80',
                femaleReferenceRange: '< 1:80',
                method: 'Slide Agglutination',
                resultType: 'Text',
            },
        ],
    },
    {
        keywords: ['dengue'],
        parameters: [
            qualitative('Dengue NS1 Antigen', 'NS1', 'Positive/Negative', 'Rapid ICT'),
            qualitative('Dengue IgM Antibody', 'IgM', 'Positive/Negative', 'Rapid ICT'),
            qualitative('Dengue IgG Antibody', 'IgG', 'Positive/Negative', 'Rapid ICT'),
        ],
    },
    {
        keywords: ['malaria', 'mp '],
        parameters: [
            qualitative('Malaria Parasite (P. vivax)', 'P.v', 'Positive/Negative', 'Rapid ICT'),
            qualitative('Malaria Parasite (P. falciparum)', 'P.f', 'Positive/Negative', 'Rapid ICT'),
        ],
    },
    {
        keywords: ['c-reactive', 'c reactive', 'crp'],
        parameters: [
            num('C-Reactive Protein', 'CRP', 'mg/L', '< 6', '< 6', { method: 'Turbidimetry' }),
        ],
    },
    {
        keywords: ['vitamin d', '25-oh', '25 oh'],
        parameters: [
            num('25-OH Vitamin D (Total)', 'Vit D', 'ng/mL', '30 - 100', '30 - 100', {
                criticalLow: '10',
                method: 'CLIA',
            }),
        ],
    },
    {
        keywords: ['vitamin b12', 'b-12', 'cobalamin'],
        parameters: [
            num('Vitamin B12', 'B12', 'pg/mL', '211 - 911', '211 - 911', { method: 'CLIA' }),
        ],
    },
    {
        keywords: ['serum calcium', 'calcium'],
        priority: 1,
        parameters: [
            num('Serum Calcium', 'Ca', 'mg/dL', '8.6 - 10.2', '8.6 - 10.2', {
                criticalLow: '6.0',
                criticalHigh: '13.0',
                method: 'Arsenazo III',
            }),
        ],
    },
    {
        keywords: ['uric acid'],
        priority: 1,
        parameters: [
            num('Serum Uric Acid', 'UA', 'mg/dL', '3.5 - 7.2', '2.6 - 6.0', { method: 'Uricase' }),
        ],
    },
    {
        keywords: ['serum creatinine', 'creatinine'],
        priority: 1,
        parameters: [
            num('Serum Creatinine', 'CREA', 'mg/dL', '0.7 - 1.3', '0.6 - 1.1', {
                criticalHigh: '8.0',
                method: 'Jaffe Kinetic',
            }),
        ],
    },
    {
        keywords: ['blood urea', 'urea'],
        priority: 1,
        parameters: [
            num('Blood Urea', 'UREA', 'mg/dL', '17 - 43', '17 - 43', {
                criticalHigh: '150',
                method: 'Urease-GLDH',
            }),
        ],
    },
    {
        keywords: ['hemoglobin', 'haemoglobin', 'hb estimation'],
        priority: 1,
        parameters: [
            num('Hemoglobin (Hb)', 'Hb', 'g/dL', '13.0 - 17.0', '12.0 - 15.0', {
                childReferenceRange: '11.0 - 14.0',
                criticalLow: '7.0',
                criticalHigh: '20.0',
                method: 'Spectrophotometry',
            }),
        ],
    },
    {
        keywords: ['pregnancy', 'upt', 'beta hcg', 'b-hcg'],
        parameters: [qualitative('Urine Pregnancy Test (hCG)', 'UPT', 'Positive/Negative', 'Rapid ICT')],
    },
    {
        keywords: ['hiv'],
        parameters: [qualitative('HIV I & II Antibody', 'HIV', 'Reactive/Non-Reactive', 'Rapid ICT')],
    },
    {
        keywords: ['hbsag', 'hepatitis b'],
        parameters: [qualitative('HBsAg', 'HBsAg', 'Reactive/Non-Reactive', 'Rapid ICT')],
    },
    {
        keywords: ['hcv', 'hepatitis c'],
        parameters: [qualitative('Anti-HCV Antibody', 'HCV', 'Reactive/Non-Reactive', 'Rapid ICT')],
    },
];
/**
 * A test nobody has a sheet for still needs one printable line, otherwise the
 * bench opens result entry to an empty grid and the report prints a blank
 * table. One free-text row named after the test is the honest minimum.
 */
const genericSheet = (testName) => [
    {
        parameterName: testName || 'Result',
        shortName: '',
        unit: '',
        maleReferenceRange: '',
        femaleReferenceRange: '',
        method: '',
        resultType: 'Text',
        displayOrder: 1,
    },
];
/**
 * Best-guess parameter sheet for a test, matched off its name and code. The
 * entry whose longest keyword matched wins, so a specific "Fasting Blood Sugar"
 * beats a broad "sugar" and "Lipid Profile" is never mistaken for a haemogram.
 *
 * Returns an empty array when nothing matches, so callers can decide between
 * falling back to the generic sheet and leaving the test alone.
 */
const findParameterTemplate = (testName, testCode = '') => {
    const haystack = `${testName} ${testCode}`.toLowerCase();
    let best = null;
    let bestPriority = -1;
    let bestLength = 0;
    for (const entry of CATALOGUE) {
        const priority = entry.priority ?? 2;
        for (const keyword of entry.keywords) {
            if (!haystack.includes(keyword))
                continue;
            if (priority > bestPriority || (priority === bestPriority && keyword.length > bestLength)) {
                best = entry;
                bestPriority = priority;
                bestLength = keyword.length;
            }
        }
    }
    if (!best)
        return [];
    return best.parameters.map((p, idx) => ({ ...p, displayOrder: idx + 1 }));
};
exports.findParameterTemplate = findParameterTemplate;
/**
 * The sheet a test should be saved with - the matched one where we know it, a
 * single free-text line where we do not. Never returns an empty array.
 */
const parametersForTest = (testName, testCode = '') => {
    const matched = (0, exports.findParameterTemplate)(testName, testCode);
    return matched.length ? matched : genericSheet(testName);
};
exports.parametersForTest = parametersForTest;
