import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LabTest, TestParameter, ResultType, ParaFor } from '../../types';
import { testApi } from '../../api/test.api';
import { asList } from '../../utils/api-list';
import { useToast } from '../../context/ToastContext';
import { X, Pencil, Minus, Search, Check, ArrowLeft, Download } from 'lucide-react';

interface ParameterMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** After a test's parameters are saved - lets the test list refresh its counts. */
  onSaved?: () => void;
}

const RESULT_TYPES: ResultType[] = [
  'Numeric',
  'Text',
  'Dropdown',
  'Positive/Negative',
  'Reactive/Non-Reactive',
  'Normal/Abnormal',
  'Header',
];

const PARA_FOR: ParaFor[] = ['ALL', 'MALE', 'FEMALE'];

/** Under 12 years is read against the child band - same line the server draws. */
const CHILD_UP_TO_DAYS = 12 * 365 - 1;

/** 150 years - how the desktop screen writes "every age" in AGE TO. */
const FULL_LIFE_DAYS = 54750;

const blankRow = (): TestParameter => ({
  parameterName: '',
  shortName: '',
  unit: '',
  method: '',
  resultType: 'Numeric',
  displayOrder: 0,
  paraFor: 'ALL',
  minValue: '',
  maxValue: '',
  highRange: '',
  lowRange: '',
  ageFromDays: 0,
  ageToDays: FULL_LIFE_DAYS,
  referenceText: '',
  criticalLow: '',
  criticalHigh: '',
  maleReferenceRange: '',
  femaleReferenceRange: '',
  childReferenceRange: '',
});

const isHeader = (p: TestParameter) => p.resultType === 'Header';

/** A section title carries no age window - it shows 0 / 0 like the desktop grid. */
const headerRow = (name: string, displayOrder: number): TestParameter => ({
  ...blankRow(),
  parameterName: name,
  resultType: 'Header',
  displayOrder,
  ageFromDays: 0,
  ageToDays: 0,
});

/** An open-ended window (AGE TO 0, from before) reads as the whole of life. */
const withFullLife = (p: TestParameter): TestParameter =>
  isHeader(p) || Number(p.ageToDays) > 0 ? p : { ...p, ageToDays: FULL_LIFE_DAYS };
const nameKey = (p: TestParameter) => String(p.parameterName || '').trim().toLowerCase();
const blank = (v?: string) => !String(v ?? '').trim();

/** "13.5 - 17.5", "< 200", "> 40" or a word like "Negative". */
const parseRange = (range?: string) => {
  const r = String(range || '').trim();
  const band = r.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (band) return { minValue: band[1], maxValue: band[2], referenceText: '' };
  const upper = r.match(/^<\s*=?\s*([\d.]+)$/);
  if (upper) return { minValue: '', maxValue: upper[1], referenceText: '' };
  const lower = r.match(/^>\s*=?\s*([\d.]+)$/);
  if (lower) return { minValue: lower[1], maxValue: '', referenceText: '' };
  return { minValue: '', maxValue: '', referenceText: r };
};

/**
 * A line saved before this screen carries male / female / child strings. It is
 * split into the band rows this screen works in, cut the same way the server
 * reads the old strings - a child band below 12 years, the adult bands above.
 */
/** HIGH / LOW RANGE left blank follow MAX / MIN - a header or text line has none. */
const withRangeLimits = (p: TestParameter): TestParameter =>
  isHeader(p)
    ? p
    : {
        ...p,
        highRange: blank(p.highRange) ? String(p.maxValue || '').trim() : p.highRange,
        lowRange: blank(p.lowRange) ? String(p.minValue || '').trim() : p.lowRange,
      };

const toBandRows = (p: TestParameter): TestParameter[] => withBandRows(p).map(withRangeLimits);

const withBandRows = (p: TestParameter): TestParameter[] => {
  const male = String(p.maleReferenceRange || '').trim();
  const female = String(p.femaleReferenceRange || '').trim();
  const child = String(p.childReferenceRange || '').trim();
  if (!male && !female && !child) return [withFullLife({ ...blankRow(), ...p })];

  const base = { ...blankRow(), ...p, maleReferenceRange: '', femaleReferenceRange: '', childReferenceRange: '' };
  const adultFrom = child ? CHILD_UP_TO_DAYS + 1 : 0;
  const rows: TestParameter[] = [];

  if (child) rows.push({ ...base, ...parseRange(child), paraFor: 'ALL', ageFromDays: 0, ageToDays: CHILD_UP_TO_DAYS });
  if (male && female && male !== female) {
    rows.push({ ...base, ...parseRange(male), paraFor: 'MALE', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
    rows.push({ ...base, ...parseRange(female), paraFor: 'FEMALE', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
  } else if (male || female) {
    rows.push({ ...base, ...parseRange(male || female), paraFor: 'ALL', ageFromDays: adultFrom, ageToDays: FULL_LIFE_DAYS });
  }
  return rows;
};

/** Grouped by ORDER, then youngest band first - how the desktop grid reads. */
const sortRows = (list: TestParameter[]) =>
  [...list].sort(
    (a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0) ||
      (a.ageFromDays || 0) - (b.ageFromDays || 0) ||
      PARA_FOR.indexOf(a.paraFor || 'ALL') - PARA_FOR.indexOf(b.paraFor || 'ALL')
  );

// The window keeps the desktop screen's layout - title bar, a dark strip of
// entry boxes with ADD / RESET, one ruled white grid with EDT / FNT / DLT - in
// the app's own colours: the slate header and sidebar, and the blue primary.
const LABEL = 'mb-0.5 block truncate text-[11px] font-medium uppercase text-slate-300';
const BOX =
  'h-[26px] w-full rounded-md border border-slate-600 bg-white px-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-300';
const TH = 'border border-slate-300 px-2 py-1.5 text-left text-[11px] font-semibold uppercase text-slate-700';
const TD = 'border border-slate-200 px-2 py-1';
const STRIP_BUTTON =
  'h-[26px] rounded-md border border-slate-600 bg-slate-800 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50';

/**
 * Ages are typed in whatever unit reads naturally - 7 days, 6 months, 12 years
 * - and stored in days. A year is 365 days and a month 30, the same count the
 * server uses when it works out a patient's age from the years on the file.
 */
type AgeUnit = 'DAYS' | 'MONTHS' | 'YEARS';
const AGE_UNITS: AgeUnit[] = ['DAYS', 'MONTHS', 'YEARS'];
const DAYS_PER: Record<AgeUnit, number> = { DAYS: 1, MONTHS: 30, YEARS: 365 };

interface AgeInput {
  value: string;
  unit: AgeUnit;
}

const blankAge = (): AgeInput => ({ value: '0', unit: 'DAYS' });
const fullLifeAge = (): AgeInput => ({ value: '150', unit: 'YEARS' });

/** Stored days back into the largest unit that divides them evenly. */
const ageFromDays = (days?: number): AgeInput => {
  const d = Number(days) || 0;
  if (d > 0 && d % 365 === 0) return { value: String(d / 365), unit: 'YEARS' };
  if (d > 0 && d % 30 === 0) return { value: String(d / 30), unit: 'MONTHS' };
  return { value: String(d), unit: 'DAYS' };
};

const ageToDays = (age: AgeInput) => Math.round((Number(age.value) || 0) * DAYS_PER[age.unit]);

interface Editing {
  testId: string;
  index: number;
}

/**
 * The parameter master for the whole catalogue - opened once from the top of
 * the test list. Every test's parameters sit in one grid under the test's
 * name; the TEST NAME box says which test a new line goes into. Like the
 * desktop screen, ADD / UPDATE / DLT write straight away - there is no
 * separate save step to forget.
 */
export const ParameterMasterModal: React.FC<ParameterMasterModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();

  const [tests, setTests] = useState<LabTest[]>([]);
  // Each test's lines in the band layout, keyed by test id.
  const [rowsByTest, setRowsByTest] = useState<Record<string, TestParameter[]>>({});
  const [loadingTests, setLoadingTests] = useState(false);
  const [testId, setTestId] = useState('');
  const [form, setForm] = useState<TestParameter>(blankRow());
  const [editing, setEditing] = useState<Editing | null>(null);
  // FNT opens the second strip - order, result type, method and the rest.
  const [showMore, setShowMore] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [ageFrom, setAgeFrom] = useState<AgeInput>(blankAge());
  const [ageTo, setAgeTo] = useState<AgeInput>(fullLifeAge());
  // EDT edits the line in place in the grid; FNT still uses the strip above.
  const [inline, setInline] = useState<{ testId: string; index: number; row: TestParameter } | null>(null);
  // The test whose sheet is copied onto the selected one - a TPA's copy of a
  // test the centre already runs takes its lines from there.
  const [importFrom, setImportFrom] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTestId('');
    setSearch('');
    setForm(blankRow());
    setAgeFrom(blankAge());
    setAgeTo(fullLifeAge());
    setEditing(null);
    setInline(null);
    setShowMore(false);
    setMinimised(false);
    setImportFrom('');
    setLoadingTests(true);
    testApi
      .getAll({ page: 1, limit: 2000 })
      .then((res) => {
        const list = asList<LabTest>(res, 'tests');
        setTests(list);
        const byTest: Record<string, TestParameter[]> = {};
        list.forEach((t) => {
          byTest[t.id] = sortRows((t.parameters || []).flatMap(toBandRows));
        });
        setRowsByTest(byTest);
      })
      .catch(() => showToast('Failed to load the test list', 'error'))
      .finally(() => setLoadingTests(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const setField = (field: keyof TestParameter, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(blankRow());
    setAgeFrom(blankAge());
    setAgeTo(fullLifeAge());
    setEditing(null);
    setShowMore(false);
  };

  /** Writes one test's lines and keeps the grid in step with what was saved. */
  const saveTest = async (id: string, rows: TestParameter[]) => {
    setBusy(true);
    try {
      await testApi.updateParameters(id, rows);
      setRowsByTest((prev) => ({ ...prev, [id]: rows }));
      onSaved?.();
      return true;
    } catch (err: any) {
      showToast(err?.message || err?.response?.data?.message || 'Failed to save parameters', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editing?.testId || testId;
    const test = tests.find((t) => t.id === id);
    if (!test) {
      showToast('Select the TEST NAME first', 'error');
      return;
    }
    const name = String(form.parameterName || '').trim();
    if (!name) return;

    const from = ageToDays(ageFrom);
    const to = ageToDays(ageTo);
    if (to !== 0 && to < from) {
      showToast('AGE TO cannot be less than AGE FROM', 'error');
      return;
    }

    const rows = rowsByTest[id] || [];
    const nextOrder = rows.reduce((max, r) => Math.max(max, r.displayOrder || 0), 0) + 1;
    // Another band of a parameter already on the test keeps its place, unit
    // and type; a new name goes to the end.
    const sibling = editing === null ? rows.find((r) => nameKey(r) === name.toLowerCase()) : undefined;
    let row: TestParameter = {
      ...form,
      parameterName: name,
      ageFromDays: from,
      ageToDays: to,
      displayOrder: Number(form.displayOrder) || sibling?.displayOrder || nextOrder,
      unit: blank(form.unit) && sibling ? sibling.unit : form.unit,
      method: blank(form.method) && sibling ? sibling.method : form.method,
      resultType: form.resultType === 'Numeric' && sibling ? sibling.resultType : form.resultType,
    };
    row = withRangeLimits(row);

    // A numeric line with no range and no unit has nothing to be read against
    // - it is a section title like RBC INDICES.
    const looksLikeHeader =
      row.resultType === 'Numeric' &&
      blank(row.minValue) &&
      blank(row.maxValue) &&
      blank(row.unit) &&
      blank(row.referenceText);
    if (row.resultType === 'Header' || looksLikeHeader) {
      row = headerRow(name, row.displayOrder);
    }

    const next = editing ? rows.map((r, idx) => (idx === editing.index ? row : r)) : [...rows, row];
    // Every band of one parameter shares its ORDER, so the sheet keeps them together.
    const saved = sortRows(
      next.map((r) => (nameKey(r) === name.toLowerCase() ? { ...r, displayOrder: row.displayOrder } : r))
    );
    if (await saveTest(id, saved)) {
      const keepTest = testId;
      resetForm();
      setTestId(keepTest || id);
    }
  };

  /**
   * Copies every line of another test onto the selected one. A test that
   * already has lines is replaced, not merged - a half-merged sheet would
   * print both labs' bands side by side - so that is confirmed first.
   */
  const handleImport = async () => {
    const target = tests.find((t) => t.id === testId);
    const source = tests.find((t) => t.id === importFrom);
    if (!target || !source) return;
    const sourceRows = rowsByTest[source.id] || [];
    if (!sourceRows.length) {
      showToast(`${source.testName} has no parameters to import`, 'error');
      return;
    }
    const current = rowsByTest[target.id] || [];
    if (
      current.length &&
      !window.confirm(
        `${target.testName} already has ${current.length} line(s). Replace them with the ${sourceRows.length} from ${source.testName}?`
      )
    )
      return;
    if (await saveTest(target.id, sourceRows.map((r) => ({ ...r })))) {
      showToast(`Imported ${sourceRows.length} line(s) from ${source.testName}`, 'success');
      setImportFrom('');
    }
  };

  const handleEdit = (id: string, index: number, more = false) => {
    setInline(null);
    const row = rowsByTest[id][index];
    setForm({ ...blankRow(), ...row });
    setAgeFrom(ageFromDays(row.ageFromDays));
    setAgeTo(ageFromDays(row.ageToDays));
    setTestId(id);
    setEditing({ testId: id, index });
    setShowMore(more);
  };

  /**
   * One step back at a time: out of an edit first, then from a single test
   * back to every test, and only then out of the window to the test list.
   */
  const goBack = () => {
    if (inline) setInline(null);
    else if (editing || showMore) resetForm();
    else if (testId || search) {
      setTestId('');
      setSearch('');
    } else onClose();
  };

  const backTitle = inline || editing || showMore
    ? 'Cancel the edit'
    : testId || search
    ? 'Back to all tests'
    : 'Back to the test list';

  const startInline = (id: string, index: number) => {
    resetForm();
    setInline({ testId: id, index, row: { ...blankRow(), ...rowsByTest[id][index] } });
  };

  const setInlineField = (field: keyof TestParameter, value: any) =>
    setInline((prev) => (prev ? { ...prev, row: { ...prev.row, [field]: value } } : prev));

  const saveInline = async () => {
    if (!inline) return;
    const { testId: id, index } = inline;
    const name = String(inline.row.parameterName || '').trim();
    if (!name) {
      showToast('Parameter name cannot be empty', 'error');
      return;
    }
    const from = Number(inline.row.ageFromDays) || 0;
    const to = Number(inline.row.ageToDays) || 0;
    if (!isHeader(inline.row) && to !== 0 && to < from) {
      showToast('AGE TO cannot be less than AGE FROM', 'error');
      return;
    }
    const order = Number(inline.row.displayOrder) || 1;
    const row = isHeader(inline.row)
      ? headerRow(name, order)
      : { ...inline.row, parameterName: name, ageFromDays: from, ageToDays: to, displayOrder: order };

    const next = (rowsByTest[id] || []).map((r, idx) => (idx === index ? row : r));
    // Every band of one parameter shares its ORDER, so the sheet keeps them together.
    const saved = sortRows(
      next.map((r) => (nameKey(r) === name.toLowerCase() ? { ...r, displayOrder: order } : r))
    );
    if (await saveTest(id, saved)) setInline(null);
  };

  const handleRemove = async (id: string, index: number) => {
    const row = rowsByTest[id][index];
    const test = tests.find((t) => t.id === id);
    if (!window.confirm(`Delete "${row.parameterName}" (${row.paraFor || 'ALL'}) from ${test?.testName}?`)) return;
    if (await saveTest(id, rowsByTest[id].filter((_, idx) => idx !== index))) {
      if (editing?.testId === id) resetForm();
    }
  };

  // Tests that can lend their sheet to the selected one - the same name first.
  const testKey = (name?: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetKey = testKey(tests.find((t) => t.id === testId)?.testName);
  const importChoices = tests
    .filter((t) => t.id !== testId && (rowsByTest[t.id] || []).length > 0)
    .sort((a, b) => Number(testKey(b.testName) === targetKey) - Number(testKey(a.testName) === targetKey));

  const formIsHeader = form.resultType === 'Header';
  const activeTestId = editing?.testId || testId;
  const namesForTest = Array.from(new Set((rowsByTest[activeTestId] || []).map((r) => r.parameterName)));

  // TEST NAME narrows the grid to that one test; the search box finds a test
  // by its name, code or any parameter inside it.
  const term = search.trim().toLowerCase();
  const visibleTests = tests.filter((t) => {
    if (activeTestId && t.id !== activeTestId) return false;
    if (!term) return true;
    if (`${t.testName} ${t.testCode}`.toLowerCase().includes(term)) return true;
    return (rowsByTest[t.id] || []).some((r) => nameKey(r).includes(term));
  });

  const field = (title: string, key: keyof TestParameter, numeric = false) => (
    <div className="min-w-0">
      <label className={LABEL} title={title}>
        {title}
      </label>
      <input
        value={(form[key] as any) ?? ''}
        onChange={(e) => setField(key, numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        disabled={formIsHeader && key !== 'parameterName'}
        className={BOX}
        required={key === 'parameterName'}
        list={key === 'parameterName' ? 'parameter-names' : undefined}
        inputMode={numeric ? 'numeric' : undefined}
      />
    </div>
  );

  const ageField = (title: string, age: AgeInput, set: (a: AgeInput) => void) => (
    <div className="min-w-0">
      <label className={LABEL} title={title}>
        {title}
      </label>
      <div className="flex">
        <input
          value={age.value}
          onChange={(e) => set({ ...age, value: e.target.value.replace(/[^\d.]/g, '') })}
          disabled={formIsHeader}
          inputMode="decimal"
          className={`${BOX} min-w-0 flex-1`}
        />
        <select
          value={age.unit}
          onChange={(e) => set({ ...age, unit: e.target.value as AgeUnit })}
          disabled={formIsHeader}
          className={`${BOX} w-[74px] shrink-0 border-l-0 px-0.5`}
        >
          {AGE_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  let sn = 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="flex h-full max-h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Title bar - the app header's colours */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2 text-white">
          <button
            type="button"
            onClick={goBack}
            title={backTitle}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold uppercase text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h2 className="shrink-0 text-sm font-bold uppercase">Add Test Paraments</h2>
          <div className="relative ml-auto w-64 max-w-[40%]">
            <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test or parameter"
              className="h-7 w-full rounded-lg border border-slate-700 bg-slate-900 pl-6 pr-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setMinimised((m) => !m)}
              className="flex h-6 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              title={minimised ? 'Restore' : 'Minimise'}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="flex h-6 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!minimised && (
          <>
            {/* Entry strip */}
            <form onSubmit={handleAddOrUpdate} className="bg-slate-900 px-3 pb-2.5 pt-2">
              <datalist id="parameter-names">
                {namesForTest.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,2.4fr)_repeat(5,minmax(0,1fr))_minmax(0,1.7fr)_minmax(0,1.7fr)_auto_auto] items-end gap-x-1.5">
                <div className="min-w-0">
                  <label className={LABEL}>Test Name</label>
                  <select
                    value={activeTestId}
                    onChange={(e) => setTestId(e.target.value)}
                    disabled={!!editing}
                    className={BOX}
                  >
                    <option value="">{loadingTests ? 'Loading...' : '- ALL TESTS -'}</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.testName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={LABEL}>Parameter For</label>
                  <select
                    value={form.paraFor || 'ALL'}
                    onChange={(e) => setField('paraFor', e.target.value as ParaFor)}
                    disabled={formIsHeader}
                    className={BOX}
                  >
                    {PARA_FOR.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                {field('Parameter Name :', 'parameterName')}
                {field('Mini Values', 'minValue')}
                {field('Max Values', 'maxValue')}
                {field('Units', 'unit')}
                {field('High Range Value', 'highRange')}
                {field('Low Range Value', 'lowRange')}
                {ageField('Age From', ageFrom, setAgeFrom)}
                {ageField('Age To', ageTo, setAgeTo)}
                <button
                  type="submit"
                  disabled={busy}
                  className={`${STRIP_BUTTON} ${editing ? '' : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {editing ? 'UPDATE' : 'ADD'}
                </button>
                <button type="button" onClick={resetForm} className={STRIP_BUTTON}>
                  RESET
                </button>
              </div>

              {/* Same test already in the catalogue under another name or
                  TPA - pull its whole sheet across instead of typing it. */}
              {testId && !editing && !showMore && (
                <div className="mt-2 flex items-end gap-1.5 border-t border-slate-700 pt-2">
                  <div className="min-w-0 flex-1">
                    <label className={LABEL}>Import Parameters From</label>
                    <select value={importFrom} onChange={(e) => setImportFrom(e.target.value)} className={BOX}>
                      <option value="">- Select a test to copy its parameters -</option>
                      {importChoices.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.testName} ({t.testCode}) - {(rowsByTest[t.id] || []).length} lines
                            {t.tpa && typeof t.tpa === 'object' ? ` - TPA: ${t.tpa.organizationName}` : ''}
                          </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={busy || !importFrom}
                    className={`${STRIP_BUTTON} flex items-center gap-1 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                  >
                    <Download className="h-3.5 w-3.5" /> IMPORT
                  </button>
                </div>
              )}

              {showMore && (
                <div className="mt-2 grid grid-cols-[minmax(0,0.6fr)_minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] items-end gap-x-1.5 border-t border-slate-700 pt-2">
                  <div className="min-w-0">
                    <label className={LABEL}>Order</label>
                    <input
                      value={form.displayOrder || ''}
                      onChange={(e) => setField('displayOrder', Number(e.target.value.replace(/\D/g, '')) || 0)}
                      className={BOX}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={LABEL}>Result Type</label>
                    <select
                      value={form.resultType}
                      onChange={(e) => setField('resultType', e.target.value as ResultType)}
                      className={BOX}
                    >
                      {RESULT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t === 'Header' ? 'Header (section title)' : t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {field('Short Name', 'shortName')}
                  {field('Method', 'method')}
                  {field('Normal Value (Text)', 'referenceText')}
                  {field('Critical Low', 'criticalLow')}
                  {field('Critical High', 'criticalHigh')}
                </div>
              )}
            </form>

            {/* Grid - each test in its own block */}
            <div className="min-h-0 flex-1 overflow-auto bg-white text-black">
              <table className="w-full table-fixed border-collapse text-xs">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-20" />
                  <col />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-14" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-11" />
                  <col className="w-11" />
                  <col className="w-11" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#f3f3f3] shadow-[0_1px_0_#cbd5e1]">
                  <tr>
                    <th className={TH}>SN</th>
                    <th className={TH}>Para-For</th>
                    <th className={TH}>Parameters</th>
                    <th className={TH}>Mini-Range</th>
                    <th className={TH}>Max-Range</th>
                    <th className={TH}>Units</th>
                    <th className={TH}>High-Range</th>
                    <th className={TH}>Low-Range</th>
                    <th className={TH}>Order</th>
                    <th className={TH}>Age-From</th>
                    <th className={TH}>Age-To</th>
                    <th className={`${TH} text-center`}>EDT</th>
                    <th className={`${TH} text-center`}>FNT</th>
                    <th className={`${TH} text-center`}>DLT</th>
                  </tr>
                </thead>
                {loadingTests || visibleTests.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={14} className={`${TD} py-8 text-center text-slate-500`}>
                        {loadingTests ? 'Loading tests...' : 'No test matches the search.'}
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  visibleTests.map((t) => {
                    const rows = rowsByTest[t.id] || [];
                    const count = new Set(rows.filter((r) => !isHeader(r)).map(nameKey)).size;
                    return (
                      <tbody key={t.id}>
                        {/* Test name above its lines - plain, click to pick it for ADD */}
                        <tr
                          className="cursor-pointer"
                          onClick={() => !editing && !inline && setTestId(t.id)}
                          title="Click to add parameters to this test"
                        >
                          <td colSpan={14} className={`${TD} pt-2.5 font-bold uppercase text-black`}>
                            {t.testName}
                            <span className="ml-2 text-[11px] font-normal normal-case text-slate-500">
                              {t.testCode} ·{' '}
                              {count ? `${count} parameter${count === 1 ? '' : 's'}` : 'no parameters'}
                            </span>
                          </td>
                        </tr>
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={14} className={`${TD} py-2 text-center italic text-slate-400`}>
                              No parameters - select this test and ADD them above.
                            </td>
                          </tr>
                        )}
                        {rows.map((r, idx) => {
                          sn += 1;
                          const header = isHeader(r);
                          const isEditing = editing?.testId === t.id && editing.index === idx;
                          const isInline = inline?.testId === t.id && inline.index === idx;
                          if (isInline && inline) {
                            const v = inline.row;
                            const cell = (key: keyof TestParameter, numeric = false, off = false) => (
                              <td className="border border-slate-200 p-0.5">
                                <input
                                  value={(v[key] as any) ?? ''}
                                  onChange={(e) =>
                                    setInlineField(key, numeric ? e.target.value.replace(/\D/g, '') : e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveInline();
                                    }
                                    if (e.key === 'Escape') setInline(null);
                                  }}
                                  disabled={off}
                                  autoFocus={key === 'parameterName'}
                                  className="h-6 w-full border border-blue-500 px-1 text-xs outline-none disabled:border-slate-200 disabled:bg-slate-100"
                                />
                              </td>
                            );
                            const hdr = isHeader(v);
                            return (
                              <tr key={idx} className="bg-[#fff3c4]">
                                <td className={TD}>{sn}</td>
                                <td className="border border-slate-200 p-0.5">
                                  <select
                                    value={v.paraFor || 'ALL'}
                                    onChange={(e) => setInlineField('paraFor', e.target.value as ParaFor)}
                                    disabled={hdr}
                                    className="h-6 w-full border border-blue-500 text-xs disabled:border-slate-200"
                                  >
                                    {PARA_FOR.map((pf) => (
                                      <option key={pf} value={pf}>
                                        {pf}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {cell('parameterName')}
                                {cell('minValue', false, hdr)}
                                {cell('maxValue', false, hdr)}
                                {cell('unit', false, hdr)}
                                {cell('highRange', false, hdr)}
                                {cell('lowRange', false, hdr)}
                                {cell('displayOrder', true)}
                                {cell('ageFromDays', true, hdr)}
                                {cell('ageToDays', true, hdr)}
                                <td className={`${TD} text-center`}>
                                  <button type="button" onClick={saveInline} disabled={busy} title="Save (Enter)">
                                    <Check className="h-4 w-4 stroke-[3] text-green-600" />
                                  </button>
                                </td>
                                <td className={`${TD} text-center`}>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(t.id, idx, true)}
                                    title="More: result type, method, critical values"
                                    className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border border-orange-600 bg-orange-400 text-[11px] font-bold leading-none text-white"
                                  >
                                    ≡
                                  </button>
                                </td>
                                <td className={`${TD} text-center`}>
                                  <button type="button" onClick={() => setInline(null)} title="Cancel (Esc)">
                                    <X className="h-4 w-4 stroke-[3] text-slate-500" />
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                          // A header is highlighted across its title and range
                          // cells, the way the desktop grid shows RBC INDICES.
                          const hl = header ? 'bg-blue-600 font-semibold text-white' : '';
                          return (
                            <tr
                              key={idx}
                              className={
                                isEditing ? 'bg-[#fff3c4]' : header ? '' : idx % 2 ? 'bg-[#fafafa] hover:bg-[#e5f1fb]' : 'hover:bg-[#e5f1fb]'
                              }
                              onDoubleClick={() => startInline(t.id, idx)}
                            >
                              <td className={TD}>{sn}</td>
                              <td className={TD}>{header ? '' : r.paraFor || 'ALL'}</td>
                              <td className={`${TD} ${hl} truncate`} title={r.parameterName}>
                                {r.parameterName}
                              </td>
                              <td className={`${TD} ${hl} truncate`}>
                                {header ? '' : r.minValue || (!r.maxValue ? r.referenceText : '')}
                              </td>
                              <td className={`${TD} ${hl}`}>{header ? '' : r.maxValue}</td>
                              <td className={`${TD} ${hl} truncate`}>{header ? '' : r.unit}</td>
                              <td className={`${TD} ${hl}`}>{header ? '' : r.highRange}</td>
                              <td className={`${TD} ${hl}`}>{header ? '' : r.lowRange}</td>
                              <td className={TD}>{r.displayOrder}</td>
                              <td className={TD}>{r.ageFromDays || 0}</td>
                              <td className={TD}>{r.ageToDays || 0}</td>
                              <td className={`${TD} text-center`}>
                                <button type="button" onClick={() => startInline(t.id, idx)} title="Edit">
                                  <Pencil className="h-4 w-4 fill-red-600 text-red-800" />
                                </button>
                              </td>
                              <td className={`${TD} text-center`}>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(t.id, idx, true)}
                                  title="Order, result type, method, critical values"
                                  className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border border-orange-600 bg-orange-400 text-[11px] font-bold leading-none text-white"
                                >
                                  ≡
                                </button>
                              </td>
                              <td className={`${TD} text-center`}>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(t.id, idx)}
                                  disabled={busy}
                                  title="Delete"
                                >
                                  <X className="h-4 w-4 stroke-[5] text-red-600" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })
                )}
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-300 bg-[#f3f3f3] px-3 py-1 text-[11px] text-slate-600">
              <span>
                {activeTestId
                  ? 'Showing 1 test - set TEST NAME to "ALL TESTS" to see every test.'
                  : `${visibleTests.length} of ${tests.length} tests`}
              </span>
              <span>{busy ? 'Saving...' : 'ADD / UPDATE / DLT save immediately.'}</span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
