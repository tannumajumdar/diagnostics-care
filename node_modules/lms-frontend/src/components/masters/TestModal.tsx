import React, { useState, useEffect, useMemo } from 'react';
import { LabTest, Department, ProcessingMode, Organization } from '../../types';
import { testApi } from '../../api/test.api';
import { asList } from '../../utils/api-list';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Download, Sparkles } from 'lucide-react';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  test?: LabTest | null;
  departments: Department[];
  /** Corporate / insurance TPAs a test can be booked under. */
  organizations?: Organization[];
}

/** "Lipid Profile", "LIPID-PROFILE" and "lipid profile " are one test. */
const nameKey = (v?: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const tpaId = (t?: LabTest | null) =>
  !t?.tpa ? '' : typeof t.tpa === 'object' ? t.tpa.id : String(t.tpa);

const tpaName = (t: LabTest) => (t.tpa && typeof t.tpa === 'object' ? t.tpa.organizationName : '');

/** A parameter with a row per age / sex band counts once. */
const paramCount = (t: LabTest) =>
  new Set(
    (t.parameters || [])
      .filter((p) => p.resultType !== 'Header')
      .map((p) => String(p.parameterName || '').trim().toLowerCase())
  ).size;

export const TestModal: React.FC<TestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  test,
  departments,
  organizations = [],
}) => {
  const [testName, setTestName] = useState('');
  const [testCode, setTestCode] = useState('');
  const [department, setDepartment] = useState('');
  const [rate, setRate] = useState(500);
  // What the referring doctor's own copy prints, and where the work is done.
  const [referralRate, setReferralRate] = useState(500);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('In-house');
  const [outsourceLab, setOutsourceLab] = useState('');
  const [outsourceCost, setOutsourceCost] = useState(0);
  // Which TPA the test is booked under ('' = the centre's own catalogue), and
  // the existing test whose parameter sheet is copied onto this one.
  const [tpa, setTpa] = useState('');
  const [importFrom, setImportFrom] = useState('');
  const [importSearch, setImportSearch] = useState('');
  const [catalogue, setCatalogue] = useState<LabTest[]>([]);

  // Every test the centre has, so a TPA's test can pick up the sheet of the
  // same investigation instead of it being typed line by line again.
  useEffect(() => {
    if (!isOpen) return;
    testApi
      .getAll({ page: 1, limit: 2000 })
      .then((res) => setCatalogue(asList<LabTest>(res, 'tests')))
      .catch(() => setCatalogue([]));
  }, [isOpen]);

  useEffect(() => {
    if (test) {
      setTestName(test.testName);
      setTestCode(test.testCode);
      setDepartment(typeof test.department === 'object' ? test.department.id : test.department);
      setRate(test.rate || 500);
      // A test saved before referral rates existed reads back at its own
      // rate, so the doctor's copy is never shown below what the centre
      // itself charges.
      setReferralRate(Number(test.referralRate) || Number(test.rate) || 0);
      setProcessingMode(test.processingMode === 'Outsource' ? 'Outsource' : 'In-house');
      setOutsourceLab(test.outsourceLab || '');
      setOutsourceCost(Number(test.outsourceCost) || 0);
      setTpa(tpaId(test));
    } else {
      setTestName('');
      setTestCode('');
      setDepartment(departments[0]?.id || '');
      setRate(500);
      setReferralRate(500);
      setProcessingMode('In-house');
      setOutsourceLab('');
      setOutsourceCost(0);
      setTpa('');
    }
    setImportFrom('');
    setImportSearch('');
  }, [test, isOpen, departments]);

  // Tests that can lend their sheet: anything but this one, with lines on it.
  const sources = useMemo(
    () => catalogue.filter((t) => t.id !== test?.id && (t.parameters || []).length > 0),
    [catalogue, test]
  );

  /**
   * The same test already in the catalogue - matched on name or code, the
   * centre's own copy ahead of another TPA's, then the one with more lines.
   */
  const match = useMemo(() => {
    const byName = nameKey(testName);
    const byCode = nameKey(testCode);
    if (!byName && !byCode) return null;
    const hits = sources.filter(
      (t) =>
        (byName.length > 2 && nameKey(t.testName) === byName) ||
        (byCode.length > 1 && nameKey(t.testCode) === byCode)
    );
    hits.sort((a, b) => Number(!!a.tpa) - Number(!!b.tpa) || paramCount(b) - paramCount(a));
    return hits[0] || null;
  }, [sources, testName, testCode]);

  const importTerm = importSearch.trim().toLowerCase();
  const importOptions = sources.filter(
    (t) =>
      t.id === importFrom ||
      !importTerm ||
      `${t.testName} ${t.testCode} ${tpaName(t)}`.toLowerCase().includes(importTerm)
  );
  const importSource = sources.find((t) => t.id === importFrom) || null;

  const pickSource = (source: LabTest) => {
    setImportFrom(source.id);
    // A new test takes the source's name and bench unless they were already typed.
    if (!test) {
      if (!testName.trim()) setTestName(source.testName);
      const dept = typeof source.department === 'object' ? source.department?.id : source.department;
      if (dept && departments.some((d) => d.id === dept)) setDepartment(dept);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      testName,
      testCode,
      department,
      rate: Number(rate),
      referralRate: Number(referralRate) || 0,
      processingMode,
      // A test run at the bench carries no courier address, so switching it
      // back cannot leave a stale lab name printing on the sample slip.
      outsourceLab: processingMode === 'Outsource' ? outsourceLab.trim() : '',
      outsourceCost: processingMode === 'Outsource' ? Number(outsourceCost) || 0 : 0,
      tpa: tpa || null,
      ...(importFrom ? { importParametersFrom: importFrom } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-2xl bg-card p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">
            {test ? 'Edit Lab Test' : 'Add New Lab Test Catalog'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Test Name *</label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} required />
            </div>
            <div>
              <label className="font-semibold block mb-1">Test Code *</label>
              <Input value={testCode} onChange={(e) => setTestCode(e.target.value.toUpperCase())} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-10 rounded-xl border px-3 text-xs bg-background"
                required
              >
                <option value="">Select Dept</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Standard Rate (₹) *</label>
              <Input type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
              {!test && (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Corporate, doctor and emergency rates start here - tune them under Rates.
                </span>
              )}
            </div>
          </div>

          {/* A TPA's test is the same investigation under their name, code
              and tariff - left blank it is the centre's own catalogue. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">TPA / Organization</label>
              <select
                value={tpa}
                onChange={(e) => setTpa(e.target.value)}
                className="w-full h-10 rounded-xl border px-3 text-xs bg-background"
              >
                <option value="">None - own catalogue</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.organizationName}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {tpa
                  ? 'Booked for this TPA. Its code must differ from your own test’s code.'
                  : 'Pick a TPA when this test comes from a corporate / insurance tie-up.'}
              </span>
            </div>
          </div>

          {/* The referring doctor's own copy is a separate bill at a separate
              price - higher than the centre's, the difference being what the
              doctor keeps. Nothing here touches what the patient pays. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Referring Doctor&rsquo;s Rate (₹)</label>
              <Input
                type="number"
                min={0}
                value={referralRate}
                onChange={(e) => setReferralRate(Number(e.target.value))}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {Number(referralRate) > Number(rate) ? (
                  <span className="font-semibold text-emerald-600">
                    ₹{Number(referralRate) - Number(rate)} above the standard rate - printed on the
                    doctor&rsquo;s bill only.
                  </span>
                ) : Number(referralRate) < Number(rate) ? (
                  <span className="font-semibold text-amber-600">
                    Below the standard rate - the doctor&rsquo;s bill would print under what the centre charges.
                  </span>
                ) : (
                  'Same as the standard rate. Mark it up and the difference is the doctor’s cut.'
                )}
              </span>
            </div>

            <div>
              <label className="font-semibold block mb-1">Processing *</label>
              <div className="flex overflow-hidden rounded-xl border">
                {(['In-house', 'Outsource'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProcessingMode(mode)}
                    className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                      processingMode === mode
                        ? mode === 'Outsource'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {processingMode === 'Outsource'
                  ? 'Sample is couriered out. The desk can still flip a single bill back.'
                  : 'Run at the centre’s own bench.'}
              </span>
            </div>
          </div>

          {processingMode === 'Outsource' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div>
                <label className="font-semibold block mb-1">Outsourced To</label>
                <Input
                  value={outsourceLab}
                  onChange={(e) => setOutsourceLab(e.target.value)}
                  placeholder="e.g. Metropolis Reference Lab"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Their Charge to Us (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={outsourceCost}
                  onChange={(e) => setOutsourceCost(Number(e.target.value))}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {Number(outsourceCost) > 0
                    ? `Margin on this test: ₹${Number(rate) - Number(outsourceCost)}`
                    : 'What the outside lab bills the centre for this test.'}
                </span>
              </div>
            </div>
          )}

          {/* Parameters have their own window (Edit Parameter at the top of the test list).
              When the same test already sits in the catalogue - the centre's
              own, usually, while this one is a TPA's - its sheet is copied
              across so nobody types the lines and ranges twice. */}
          <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-2 font-semibold">
              <Download className="h-4 w-4 text-blue-600" />
              <span>Import Parameters From Existing Test</span>
            </div>

            {match && match.id !== importFrom && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{match.testName}</strong> ({match.testCode}) is already in{' '}
                    {tpaName(match) ? `${tpaName(match)}'s tests` : 'your catalogue'} with {paramCount(match)}{' '}
                    parameter{paramCount(match) === 1 ? '' : 's'}.
                  </span>
                </span>
                <Button type="button" size="sm" className="h-7 shrink-0" onClick={() => pickSource(match)}>
                  Import
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                placeholder="Search test name or code..."
              />
              <select
                value={importFrom}
                onChange={(e) => {
                  const source = sources.find((t) => t.id === e.target.value);
                  if (source) pickSource(source);
                  else setImportFrom('');
                }}
                className="w-full h-10 rounded-xl border px-3 text-xs bg-background"
              >
                <option value="">Don&rsquo;t import</option>
                {importOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.testName} ({t.testCode}) · {paramCount(t)} params
                    {tpaName(t) ? ` · ${tpaName(t)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {importSource ? (
                <span className={test ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                  {test
                    ? `Saving replaces this test's current parameters with the ${paramCount(importSource)} from ${importSource.testName}.`
                    : `${paramCount(importSource)} parameters with their ranges will be copied from ${importSource.testName}.`}{' '}
                  Fine-tune them afterwards from Edit Parameter.
                </span>
              ) : test ? (
                'Parameters and their ranges are edited from Edit Parameter at the top of the test list.'
              ) : (
                'Without an import a standard parameter sheet is built from the test name - edit it afterwards from Edit Parameter.'
              )}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {test ? 'Save Changes' : 'Create Test'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
