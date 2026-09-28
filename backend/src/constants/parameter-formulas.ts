/**
 * The calculated lines most panels carry, and how each is worked out from the
 * panel's measured lines. Matched by parameter name, so they apply to a test
 * whatever it is called on the menu, and only when every line the formula
 * needs is on that test.
 *
 * INR is left out on purpose: it needs the ISI of the lab's own PT reagent,
 * which only the lab knows - add it by hand as round((#PT# / #CONTROL#) ^ ISI, 2).
 */

type Rule = {
  /** The calculated line. */
  target: RegExp;
  /** Measured lines it needs, by role. */
  inputs: Record<string, RegExp>;
  /** The formula with {role} where each input's #name# goes. */
  formula: string;
};

const RULES: Rule[] = [
  // CBC red cell indices
  {
    target: /^MCV$/i,
    inputs: { PCV: /haematocrit|hematocrit|\bPCV\b|\bHCT\b/i, RBC: /RBC\s*count|total\s*RBC|^RBC$/i },
    formula: 'round({PCV} * 10 / {RBC}, 1)',
  },
  {
    target: /^MCH$/i,
    inputs: { HB: /haemoglobin|hemoglobin|^HB$|^HGB$/i, RBC: /RBC\s*count|total\s*RBC|^RBC$/i },
    formula: 'round({HB} * 10 / {RBC}, 1)',
  },
  {
    target: /^MCHC$/i,
    inputs: { HB: /haemoglobin|hemoglobin|^HB$|^HGB$/i, PCV: /haematocrit|hematocrit|\bPCV\b|\bHCT\b/i },
    formula: 'round({HB} * 100 / {PCV}, 1)',
  },
  // Lipid profile - Friedewald
  { target: /^VLDL/i, inputs: { TG: /triglyceride/i }, formula: 'round({TG} / 5, 1)' },
  {
    target: /^LDL(\s*cholesterol)?$|^LDL-?C$/i,
    inputs: { TC: /^total\s*cholesterol$|^cholesterol,?\s*total$/i, HDL: /^HDL/i, TG: /triglyceride/i },
    formula: 'round({TC} - {HDL} - ({TG} / 5), 1)',
  },
  {
    target: /^non[-\s]?HDL/i,
    inputs: { TC: /^total\s*cholesterol$|^cholesterol,?\s*total$/i, HDL: /^HDL/i },
    formula: 'round({TC} - {HDL}, 1)',
  },
  {
    target: /cholesterol\s*\/\s*HDL|TC\s*\/\s*HDL|chol\/hdl/i,
    inputs: { TC: /^total\s*cholesterol$|^cholesterol,?\s*total$/i, HDL: /^HDL/i },
    formula: 'round({TC} / {HDL}, 2)',
  },
  {
    target: /LDL\s*\/\s*HDL/i,
    inputs: { LDL: /^LDL/i, HDL: /^HDL/i },
    formula: 'round({LDL} / {HDL}, 2)',
  },
  // Liver
  {
    target: /indirect\s*bilirubin/i,
    inputs: { TBIL: /total\s*bilirubin/i, DBIL: /direct\s*bilirubin/i },
    formula: 'round({TBIL} - {DBIL}, 2)',
  },
  {
    target: /^globulin$/i,
    inputs: { TP: /total\s*protein/i, ALB: /^albumin$/i },
    formula: 'round({TP} - {ALB}, 2)',
  },
  {
    target: /^A\s*\/\s*G/i,
    inputs: { ALB: /^albumin$/i, GLB: /^globulin$/i },
    formula: 'round({ALB} / {GLB}, 2)',
  },
  // Kidney
  { target: /urea\s*nitrogen|^BUN$/i, inputs: { UREA: /^(blood|serum)?\s*urea$/i }, formula: 'round({UREA} / 2.14, 1)' },
  {
    target: /BUN\s*\/\s*creatinine/i,
    inputs: { BUN: /urea\s*nitrogen|^BUN$/i, CREA: /creatinine/i },
    formula: 'round({BUN} / {CREA}, 1)',
  },
  {
    // CKD-EPI 2021, race-free.
    target: /^eGFR/i,
    inputs: { CREA: /^(serum\s*)?creatinine$/i },
    formula:
      'round(142 * min({CREA} / (0.7 * #FEMALE# + 0.9 * #MALE#), 1) ^ (-0.241 * #FEMALE# - 0.302 * #MALE#)' +
      ' * max({CREA} / (0.7 * #FEMALE# + 0.9 * #MALE#), 1) ^ (-1.2) * 0.9938 ^ #AGE# * (1 + 0.012 * #FEMALE#), 0)',
  },
  // Diabetes
  {
    target: /estimated\s*average\s*glucose|^eAG$/i,
    inputs: { A1C: /HbA1c|glycated/i },
    formula: 'round(28.7 * {A1C} - 46.7, 0)',
  },
  // Iron
  {
    target: /transferrin\s*saturation|^TSAT$/i,
    inputs: { FE: /^(serum\s*)?iron$/i, TIBC: /TIBC|total\s*iron\s*binding/i },
    formula: 'round({FE} / {TIBC} * 100, 1)',
  },
  // Blood gas - Henderson-Hasselbalch
  {
    target: /HCO|bicarbonate/i,
    inputs: { PH: /^pH$/i, PCO2: /pCO/i },
    formula: 'round(0.0307 * {PCO2} * 10 ^ ({PH} - 6.1), 1)',
  },
];

interface Line {
  parameterName?: string;
  shortName?: string;
  resultType?: string;
  formula?: string;
}

const matches = (p: Line, re: RegExp) => re.test(String(p.parameterName || '').trim()) || re.test(String(p.shortName || '').trim());

/**
 * The same lines with the standard formula put on each calculated line that
 * has none yet. A formula the lab typed itself is never replaced, and a line
 * is left typed when an input it needs is missing from the test.
 */
export const withStandardFormulas = <T extends Line>(parameters: T[]): T[] => {
  const lines = parameters.filter((p) => p.resultType !== 'Header');
  const formulaFor = (p: T): string => {
    for (const rule of RULES) {
      if (!matches(p, rule.target)) continue;
      let formula = rule.formula;
      let complete = true;
      for (const [role, re] of Object.entries(rule.inputs)) {
        const input = lines.find((l) => l !== p && matches(l, re) && !matches(l, rule.target));
        if (!input) {
          complete = false;
          break;
        }
        formula = formula.split(`{${role}}`).join(`#${String(input.shortName || input.parameterName).trim()}#`);
      }
      if (complete) return formula;
    }
    return '';
  };

  // Every band row of a parameter gets the same formula.
  const byName = new Map<string, string>();
  for (const p of lines) {
    const key = String(p.parameterName || '').trim().toLowerCase();
    if (byName.has(key)) continue;
    const own = parameters.find(
      (r) => String(r.parameterName || '').trim().toLowerCase() === key && String(r.formula || '').trim()
    );
    byName.set(key, own ? '' : formulaFor(p));
  }
  return parameters.map((p) => {
    if (p.resultType === 'Header' || String(p.formula || '').trim()) return p;
    const formula = byName.get(String(p.parameterName || '').trim().toLowerCase());
    return formula ? { ...p, formula } : p;
  });
};
