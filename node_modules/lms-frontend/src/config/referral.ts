/**
 * Which kind of doctor a complaint usually comes from.
 *
 * The front desk types what the patient says, not a diagnosis, so the match is
 * on plain words a receptionist would actually write - "sugar", "pregnancy",
 * "bachcha" - rather than on clinical coding. Matching is deliberately loose:
 * a wrong suggestion costs the desk one extra tap, a missing one costs them a
 * scroll through the whole panel.
 */
export interface ReferralRule {
  /** Lower-case fragments looked for anywhere in the complaint text. */
  keywords: string[];
  /** Speciality fragments matched against the doctor master, in order. */
  specialties: string[];
}

export const REFERRAL_RULES: ReferralRule[] = [
  {
    keywords: ['diabet', 'sugar', 'fbs', 'fasting blood', 'hba1c', 'glucose'],
    specialties: ['diabetolog', 'endocrin', 'physician', 'practitioner'],
  },
  {
    keywords: ['thyroid', 'tsh', 't3', 't4'],
    specialties: ['endocrin', 'diabetolog', 'physician'],
  },
  {
    keywords: ['pregnan', 'pregnancy', 'gynae', 'gyneac', 'period', 'menstrual', 'obstetric', 'delivery'],
    specialties: ['gynaec', 'gynec', 'obs'],
  },
  {
    keywords: ['child', 'baby', 'infant', 'paediatric', 'pediatric', 'bachcha', 'newborn'],
    specialties: ['paediatric', 'pediatric'],
  },
  {
    keywords: ['pre-operative', 'preoperative', 'pre op', 'surgery', 'operation'],
    specialties: ['surgeon', 'physician', 'practitioner'],
  },
  {
    keywords: ['heart', 'chest pain', 'bp', 'blood pressure', 'hypertension', 'cardiac'],
    specialties: ['cardiolog', 'physician', 'practitioner'],
  },
  {
    keywords: ['kidney', 'renal', 'urine', 'urea', 'creatinine'],
    specialties: ['nephrolog', 'urolog', 'physician'],
  },
  {
    keywords: ['liver', 'jaundice', 'lft', 'hepat'],
    specialties: ['gastro', 'hepatolog', 'physician'],
  },
  {
    keywords: ['skin', 'rash', 'allerg'],
    specialties: ['dermatolog', 'physician'],
  },
  {
    keywords: ['bone', 'joint', 'fracture', 'arthritis', 'back pain'],
    specialties: ['orthop', 'physician'],
  },
  // The broad everyday complaints a diagnostic centre sees most, kept last so
  // a more specific rule above wins when both would match.
  {
    keywords: [
      'fever',
      'weak',
      'fatigue',
      'cough',
      'cold',
      'body ache',
      'bodyache',
      'stomach',
      'pain',
      'infection',
      'vomit',
      'loose motion',
      'headache',
      'routine',
      'health check',
      'checkup',
      'check-up',
      'anaemia',
      'anemia',
      'cbc',
      'blood count',
    ],
    specialties: ['physician', 'practitioner', 'general', 'internal medicine'],
  },
];

/** Speciality fragments that suit a complaint, best-fitting first. */
export const specialtiesForComplaint = (complaint: string): string[] => {
  const text = (complaint || '').toLowerCase().trim();
  if (!text) return [];

  const matched: string[] = [];
  REFERRAL_RULES.forEach((rule) => {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      rule.specialties.forEach((s) => {
        if (!matched.includes(s)) matched.push(s);
      });
    }
  });
  return matched;
};

export interface DoctorLike {
  id: string;
  doctorName: string;
  specialty?: string;
}

/**
 * Splits the panel into the doctors worth offering first for this complaint
 * and the rest. An empty or unrecognised complaint suggests nobody, so the
 * desk simply sees the whole panel rather than a misleading shortlist.
 */
export const rankDoctorsForComplaint = <T extends DoctorLike>(
  doctors: T[],
  complaint: string
): { suggested: T[]; others: T[] } => {
  const specialties = specialtiesForComplaint(complaint);
  if (!specialties.length) return { suggested: [], others: doctors };

  const scored = doctors.map((doctor) => {
    const specialty = (doctor.specialty || '').toLowerCase();
    // Position in the rule's list is the ranking: a diabetologist outranks a
    // general physician for a sugar test, and both outrank an unmatched panel.
    const rank = specialties.findIndex((fragment) => specialty.includes(fragment));
    return { doctor, rank };
  });

  const suggested = scored
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.doctor);

  const others = scored.filter((entry) => entry.rank < 0).map((entry) => entry.doctor);

  return { suggested, others };
};

/**
 * Which tests a complaint usually calls for.
 *
 * Matched on fragments of the test name rather than on ids, so the centre can
 * add "Dengue NS1" or "HbA1c" to the catalogue tomorrow and the suggestions
 * pick them up without anyone editing this file. Nothing here is prescriptive:
 * a patient who simply walks in asking for a sugar test still gets the whole
 * catalogue, because the suggestion only reorders, it never filters.
 */
export interface TestRule {
  keywords: string[];
  /** Lower-case fragments matched against the test name or code. */
  tests: string[];
}

export const TEST_RULES: TestRule[] = [
  {
    keywords: ['diabet', 'sugar', 'glucose', 'hba1c'],
    tests: ['sugar', 'glucose', 'fbs', 'ppbs', 'hba1c', 'gtt'],
  },
  {
    keywords: ['thyroid', 'tsh'],
    tests: ['thyroid', 'tsh', 't3', 't4'],
  },
  {
    keywords: ['pregnan', 'period', 'menstrual', 'gynae'],
    tests: ['pregnan', 'hcg', 'blood count', 'cbc', 'blood group', 'thyroid', 'haemoglobin', 'hemoglobin'],
  },
  {
    keywords: ['fever', 'infection', 'cough', 'cold', 'body ache', 'bodyache', 'headache', 'weak', 'fatigue'],
    tests: ['blood count', 'cbc', 'crp', 'esr', 'widal', 'typhoid', 'malaria', 'dengue', 'haemoglobin', 'hemoglobin'],
  },
  {
    keywords: ['anaemia', 'anemia', 'pale', 'giddiness'],
    tests: ['blood count', 'cbc', 'haemoglobin', 'hemoglobin', 'iron', 'ferritin'],
  },
  {
    keywords: ['pre-operative', 'preoperative', 'pre op', 'surgery', 'operation'],
    tests: ['blood count', 'cbc', 'blood group', 'sugar', 'glucose', 'bleeding', 'clotting', 'hiv', 'hbsag'],
  },
  {
    keywords: ['heart', 'chest pain', 'bp', 'blood pressure', 'hypertension', 'cardiac', 'cholesterol'],
    tests: ['lipid', 'cholesterol', 'sugar', 'glucose', 'ecg', 'troponin'],
  },
  {
    keywords: ['kidney', 'renal', 'urine', 'urea', 'creatinine'],
    tests: ['urine', 'urea', 'creatinine', 'kidney', 'kft', 'rft'],
  },
  {
    keywords: ['liver', 'jaundice', 'lft', 'hepat'],
    tests: ['liver', 'lft', 'bilirubin', 'sgpt', 'sgot', 'hepat'],
  },
  {
    keywords: ['stomach', 'vomit', 'loose motion', 'diarrh'],
    tests: ['stool', 'blood count', 'cbc', 'widal', 'typhoid', 'electrolyte'],
  },
  {
    keywords: ['bone', 'joint', 'arthritis', 'back pain'],
    tests: ['calcium', 'vitamin d', 'uric acid', 'ra factor', 'esr'],
  },
  // A general check-up is the widest net, so it sits last and offers the
  // routine panel a centre would actually run.
  {
    keywords: ['routine', 'health check', 'checkup', 'check-up', 'annual', 'full body'],
    tests: [
      'blood count',
      'cbc',
      'sugar',
      'glucose',
      'lipid',
      'liver',
      'kidney',
      'thyroid',
      'urine',
      'haemoglobin',
      'hemoglobin',
    ],
  },
];

export const testFragmentsForComplaint = (complaint: string): string[] => {
  const text = (complaint || '').toLowerCase().trim();
  if (!text) return [];

  const matched: string[] = [];
  TEST_RULES.forEach((rule) => {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      rule.tests.forEach((fragment) => {
        if (!matched.includes(fragment)) matched.push(fragment);
      });
    }
  });
  return matched;
};

export interface TestLike {
  id: string;
  testName: string;
  testCode?: string;
}

/**
 * Splits the catalogue into what this complaint usually needs and everything
 * else. An unrecognised complaint suggests nothing and leaves the full
 * catalogue on show - a patient who asks for one specific test by name must
 * never have to fight a shortlist to find it.
 */
export const rankTestsForComplaint = <T extends TestLike>(
  tests: T[],
  complaint: string
): { suggested: T[]; others: T[] } => {
  const fragments = testFragmentsForComplaint(complaint);
  if (!fragments.length) return { suggested: [], others: tests };

  const scored = tests.map((test) => {
    const haystack = `${test.testName} ${test.testCode ?? ''}`.toLowerCase();
    const rank = fragments.findIndex((fragment) => haystack.includes(fragment));
    return { test, rank };
  });

  return {
    suggested: scored.filter((e) => e.rank >= 0).sort((a, b) => a.rank - b.rank).map((e) => e.test),
    others: scored.filter((e) => e.rank < 0).map((e) => e.test),
  };
};
