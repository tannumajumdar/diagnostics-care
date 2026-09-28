import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { resultApi, savedReportApi } from '../../api/result.api';
import { ParameterResult } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { ArrowLeft, Save, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Lock, Eye } from 'lucide-react';
import { ageLabel } from '../../utils/age';
import { calculateSheet } from '../../utils/formula';

const selectClass =
  'flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Reads the flag off a typed value the same way the server does, so the bench
 * sees a value go red as it is typed instead of after the save round-trips.
 * The server still recalculates on save - this is a preview, not the record.
 */
const previewFlag = (value: string, range?: string, p: any = {}) => {
  const val = parseFloat(value);
  if (isNaN(val)) return 'Normal';

  const low = parseFloat(String(p.criticalLow ?? ''));
  const high = parseFloat(String(p.criticalHigh ?? ''));
  if (!isNaN(low) && val < low) return 'Critical';
  if (!isNaN(high) && val > high) return 'Critical';

  // The master's HIGH / LOW RANGE, when set, decide it outright.
  const highAt = parseFloat(String(p.highRange ?? ''));
  const lowAt = parseFloat(String(p.lowRange ?? ''));
  if (!isNaN(highAt) || !isNaN(lowAt)) {
    if (!isNaN(highAt) && val > highAt) return 'High';
    if (!isNaN(lowAt) && val < lowAt) return 'Low';
    return 'Normal';
  }

  if (!range) return 'Normal';

  const band = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (band) {
    if (val < parseFloat(band[1])) return 'Low';
    if (val > parseFloat(band[2])) return 'High';
    return 'Normal';
  }

  const upper = range.match(/<\s*=?\s*([\d.]+)/);
  if (upper) return val > parseFloat(upper[1]) ? 'High' : 'Normal';

  const lower = range.match(/>\s*=?\s*([\d.]+)/);
  if (lower) return val < parseFloat(lower[1]) ? 'Low' : 'Normal';

  return 'Normal';
};

const flagVariant = (flag: string) => {
  if (flag === 'Critical' || flag === 'High') return 'destructive' as const;
  if (flag === 'Low') return 'amber' as const;
  return 'success' as const;
};

const FLAG_CHOICES = ['Normal', 'High', 'Low', 'Critical'];

const OPTIONS_BY_TYPE: Record<string, string[]> = {
  'Positive/Negative': ['Negative', 'Positive'],
  'Reactive/Non-Reactive': ['Non-Reactive', 'Reactive'],
  'Normal/Abnormal': ['Normal', 'Abnormal'],
};

/**
 * The bench's entry screen for one patient's visit.
 *
 * A patient billed for four tests leaves four vials, but it is one sitting at
 * the analyser - so every test on that bill is on this page, one sheet each,
 * and the buttons at the foot act on all of them together. Opening any one of
 * the samples from the queue lands here and shows the whole visit.
 */
export const ResultEntryPage: React.FC = () => {
  const { sampleId } = useParams<{ sampleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  // An approved report is locked; only these two roles may open it again.
  const canEditReleased = ['Admin', 'Pathologist'].includes(String(user?.role || ''));
  const canVerify = hasPermission(user, PERMISSIONS.RESULT_VERIFY);

  // Typed values and remarks, keyed by the sheet they belong to, so two tests
  // that measure a parameter of the same name never overwrite each other.
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  // Flags picked by hand, same keying. '' means "back to automatic".
  const [flagEdits, setFlagEdits] = useState<Record<string, Record<string, string>>>({});
  // Calculated lines the bench typed over, same keying. false = back to the formula.
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['result-entry-visit', sampleId],
    queryFn: () => resultApi.getVisitBySampleId(sampleId!),
    enabled: !!sampleId,
  });

  const visitSheets = asList<any>(data, 'results');

  /**
   * Only the tests that have reached the bench. The visit's other tests move
   * on their own clocks - one may still be waiting for its draw - and a sheet
   * for a specimen nobody has run yet is not something to type values into.
   * A sheet that already has work on it stays, wherever its sample is.
   */
  const onBench = (sheet: any) => {
    const sample = typeof sheet?.sample === 'object' ? sheet.sample : {};
    return (
      ['Processing', 'Completed'].includes(sample.status) ||
      String(sample._id || sample.id) === String(sampleId) ||
      (sheet.status && sheet.status !== 'Draft') ||
      asList<any>(sheet.results).some((p: any) => String(p.value ?? '').trim() !== '')
    );
  };
  const sheets = visitSheets.filter(onBench);
  const notYetOnBench = visitSheets.filter((sheet) => !onBench(sheet));

  /**
   * Sending a result up moves it out of the bench's queue and into the
   * pathologist's, so both have to be re-read - not just the one being
   * looked at. Dropping only `results` and `samples` left the verification
   * queue on its five-minute cache, and a pathologist who had already opened
   * that screen was told nothing was waiting for them.
   */
  const invalidate = () => {
    LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  /** The sheet's parameters in the order the test master lays them out. */
  const parametersOf = (sheet: any) =>
    asList<any>(sheet?.results)
      .slice()
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const sampleOf = (sheet: any) => (typeof sheet?.sample === 'object' ? sheet.sample : {});
  const testOf = (sheet: any) => (typeof sheet?.test === 'object' ? sheet.test : {});

  const typedValueOf = (sheet: any, p: any) => {
    const typed = values[sheet._id]?.[p.parameterName];
    return typed !== undefined ? typed : p.value || '';
  };

  /** A calculated line's formula - off the sheet, or the test master for an older sheet. */
  const formulaOf = (sheet: any, p: any): string => {
    if (p?.resultType === 'Header') return '';
    if (String(p?.formula || '').trim()) return String(p.formula).trim();
    const name = String(p?.parameterName || '').trim().toLowerCase();
    const master = asList<any>(testOf(sheet).parameters).find(
      (m: any) => String(m?.parameterName || '').trim().toLowerCase() === name && String(m?.formula || '').trim()
    );
    return master ? String(master.formula).trim() : '';
  };

  const isOverridden = (sheet: any, p: any) => {
    const picked = overrides[sheet._id]?.[p.parameterName];
    return picked !== undefined ? picked : Boolean(p.formulaOverride);
  };

  /**
   * Every calculated line of a sheet, worked out from what is typed right now
   * - LDL moves as TC, HDL and TG are typed. Cached for this render only.
   */
  const calcCache = new Map<string, Map<string, string>>();
  const calculatedOf = (sheet: any) => {
    const cached = calcCache.get(sheet._id);
    if (cached) return cached;
    // A band row can lack the short name another band of the same parameter
    // has - the formula's #HB# still has to find it.
    const masterRows = asList<any>(testOf(sheet).parameters);
    const shortNameOf = (p: any) =>
      String(p?.shortName || '').trim() ||
      String(
        masterRows.find(
          (m: any) =>
            String(m?.parameterName || '').trim().toLowerCase() === String(p?.parameterName || '').trim().toLowerCase() &&
            String(m?.shortName || '').trim()
        )?.shortName || ''
      ).trim();
    const rows = parametersOf(sheet).map((p: any) => ({
      ...p,
      shortName: shortNameOf(p),
      value: typedValueOf(sheet, p),
    }));
    const patientOf = typeof sheet?.patient === 'object' && sheet.patient ? sheet.patient : {};
    const worked = calculateSheet(
      rows,
      (r: any) => formulaOf(sheet, r),
      patientOf,
      (r: any) => isOverridden(sheet, r)
    );
    const byName = new Map<string, string>();
    worked.forEach((value, index) => byName.set(rows[index].parameterName, value));
    calcCache.set(sheet._id, byName);
    return byName;
  };

  const isCalculated = (sheet: any, p: any) => Boolean(formulaOf(sheet, p)) && !isOverridden(sheet, p);

  const valueOf = (sheet: any, p: any) =>
    isCalculated(sheet, p) ? calculatedOf(sheet).get(p.parameterName) ?? '' : typedValueOf(sheet, p);

  /** The flag chosen by hand for this line, or '' when it is left to the range. */
  const manualFlagOf = (sheet: any, p: any): string => {
    const picked = flagEdits[sheet._id]?.[p.parameterName];
    if (picked !== undefined) return picked;
    return p.flagManual && p.flag ? p.flag : '';
  };

  const flagOf = (sheet: any, p: any) =>
    manualFlagOf(sheet, p) || previewFlag(valueOf(sheet, p), p.referenceRange, p);

  const setManualFlag = (sheetId: string, parameterName: string, flag: string) =>
    setFlagEdits((prev) => ({ ...prev, [sheetId]: { ...(prev[sheetId] || {}), [parameterName]: flag } }));

  const remarksOf = (sheet: any) =>
    remarks[sheet._id] !== undefined ? remarks[sheet._id] : sheet.overallRemarks || '';

  const setValue = (sheetId: string, parameterName: string, val: string) =>
    setValues((prev) => ({ ...prev, [sheetId]: { ...(prev[sheetId] || {}), [parameterName]: val } }));

  // Typing into a calculated line takes it off the formula; the button puts it back.
  const setOverride = (sheetId: string, parameterName: string, on: boolean) =>
    setOverrides((prev) => ({ ...prev, [sheetId]: { ...(prev[sheetId] || {}), [parameterName]: on } }));

  /** Header rows are section titles - nothing is typed into them. */
  const entryRowsOf = (sheet: any) => parametersOf(sheet).filter((p: any) => p.resultType !== 'Header');

  const filledCount = (sheet: any) =>
    entryRowsOf(sheet).filter((p: any) => String(valueOf(sheet, p)).trim() !== '').length;

  const payloadFor = (sheet: any): ParameterResult[] =>
    parametersOf(sheet).map((p: any) => {
      const manual = manualFlagOf(sheet, p);
      return {
        ...p,
        value: valueOf(sheet, p),
        flag: manual || previewFlag(valueOf(sheet, p), p.referenceRange, p),
        flagManual: !!manual,
        formulaOverride: Boolean(formulaOf(sheet, p)) && isOverridden(sheet, p),
      };
    });

  const isReleased = (sheet: any) => sheet?.status === 'Approved' || sheet?.status === 'Final';
  /** Approved, and this user may not change it. */
  const isLocked = (sheet: any) => isReleased(sheet) && !canEditReleased;
  /** Something was changed on screen for this sheet since it loaded. */
  const isDirty = (sheet: any) =>
    [values, remarks, flagEdits, overrides].some((m: any) => m[sheet._id] !== undefined);

  /**
   * Sheets worth writing back - anything with a value typed or already held.
   * An approved sheet goes only when it was actually edited (and only by a
   * pathologist or admin): saving it sends it back for a fresh sign-off, so an
   * untouched approved test must not be pulled back along with its neighbours.
   */
  const sheetsWithValues = () =>
    sheets.filter((sheet) => filledCount(sheet) > 0 && !isLocked(sheet) && (!isReleased(sheet) || isDirty(sheet)));

  const saveAll = async (mode: 'draft' | 'submit') => {
    const targets = mode === 'draft' ? sheets : sheetsWithValues();
    if (!targets.length) {
      showToast('Nothing has been typed in yet', 'error');
      return targets;
    }

    // One after another rather than in parallel: each save recalculates flags
    // and stamps the sample's stage, and the bench would rather have a clear
    // "this test failed" than four half-applied writes.
    for (const sheet of targets) {
      const body = {
        sampleId: sampleOf(sheet)._id || sampleOf(sheet).id,
        results: payloadFor(sheet),
        overallRemarks: remarksOf(sheet),
      };
      if (mode === 'draft') await resultApi.saveDraft(body);
      else await resultApi.submit(body);
    }
    return targets;
  };

  /**
   * Files the report as it now stands in Saved Reports - final once every test
   * on the visit is approved, provisional until then. One copy per visit,
   * whichever tests were saved; the server drops the visit's older provisional
   * copy when a new one is filed.
   */
  const fileProvisionalReports = async (targets: any[]) => {
    const perVisit = new Map<string, any>();
    for (const sheet of targets) {
      const invoice = typeof sheet.invoice === 'object' ? sheet.invoice?._id : sheet.invoice;
      const key = String(invoice || sheet._id);
      if (!perVisit.has(key)) perVisit.set(key, sheet);
    }
    for (const sheet of perVisit.values()) {
      await savedReportApi.saveFromResult(sheet._id, { provisional: true });
    }
  };

  // One Save: the values are kept and the report goes to the pathologist. Until
  // they approve it the report can be viewed, but without their signature.
  const submitMutation = useMutation({
    mutationFn: async () => {
      const targets = await saveAll('submit');
      if (!targets.length) return { targets, filed: false };
      // The values are saved either way; a report that could not be filed is
      // only worth a warning, not a failed save.
      const filed = await fileProvisionalReports(targets).then(
        () => true,
        () => false
      );
      return { targets, filed };
    },
    onSuccess: ({ targets, filed }) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      if (!targets.length) return;
      setValues({});
      setRemarks({});
      setFlagEdits({});
      setOverrides({});
      if (!filed) {
        showToast(`${targets.length} test(s) saved, but the provisional report could not be added to Saved Reports`, 'error');
        return;
      }
      showToast(
        `${targets.length} test(s) saved - the provisional report is in Saved Reports, and is signed once the pathologist approves it`,
        'success'
      );
    },
    onError: (err: any) => showToast(err?.message || 'Could not save the result', 'error'),
  });

  const verifyMutation = useMutation({
    // Approving reads the saved record on the server, so values typed here but
    // never saved would be approved away. Persist what is on screen first, then
    // release it - what the pathologist sees is what gets signed off.
    mutationFn: async (action: 'Approve' | 'Reject') => {
      // Only the tests the bench actually worked on. A blank sheet for a
      // sample still sitting in collection is not something to release, and
      // marking it Rejected would say the bench got it wrong.
      const targets = sheetsWithValues();
      if (!targets.length) throw new Error('None of these tests has any values entered yet');

      if (action === 'Approve') await saveAll('submit');

      for (const sheet of targets) {
        await resultApi.verify(sheet._id, { action });
      }
      // The approved report goes into Saved Reports; a failure there is only a
      // warning, the approval itself stands.
      const filed =
        action === 'Approve'
          ? await fileProvisionalReports(targets).then(
              () => true,
              () => false
            )
          : true;
      return { targets, filed };
    },
    onSuccess: ({ targets, filed }, action) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      if (!filed) {
        showToast(`${targets.length} test(s) approved, but the report could not be added to Saved Reports`, 'error');
      } else {
        showToast(
          action === 'Approve'
            ? `${targets.length} test(s) approved and released - the report is in Saved Reports`
            : `${targets.length} test(s) sent back to the bench`,
          'success'
        );
      }
      navigate('/results/pending');
    },
    onError: (err: any) => showToast(err?.message || 'Could not update the verification', 'error'),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading parameter entry interface...</div>;
  if (!sheets.length)
    return <div className="p-8 text-center font-semibold text-muted-foreground">Result record not found for sample.</div>;

  const patient = typeof sheets[0].patient === 'object' ? sheets[0].patient : {};
  const totalFilled = sheets.reduce((sum, sheet) => sum + filledCount(sheet), 0);
  const totalParameters = sheets.reduce((sum, sheet) => sum + entryRowsOf(sheet).length, 0);
  // An approved report is locked for everyone but a pathologist or an admin.
  // When one of them corrects it, saving sends it back for a fresh sign-off.
  const anyReleased = sheets.some(isReleased);
  const allLocked = sheets.every(isLocked);
  const anySaved = sheets.some((s) => s.status !== 'Draft' && asList<any>(s.results).some((p: any) => String(p.value ?? '').trim() !== ''));
  const dirtyCount = sheets.filter(isDirty).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Test Parameter Result Entry</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {patient.patientName} · {ageLabel(patient)} / {patient.gender} · UHID: {sheets[0].uhid}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">
            {sheets.length} of {visitSheets.length} test{visitSheets.length === 1 ? '' : 's'} on the bench
          </p>
          <p className="text-[12px] text-muted-foreground">
            {totalFilled} of {totalParameters} values filled
          </p>
        </div>
      </div>

      {anyReleased &&
        (canEditReleased ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Approved and locked for the rest of the lab. You can still correct it - saving a change sends it back
              for approval, and the patient gets the corrected copy once it is approved again.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-slate-300 bg-slate-100 p-3 text-xs text-slate-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Approved by the pathologist and locked. Only a pathologist or an admin can change an approved report.
            </span>
          </div>
        ))}

      {notYetOnBench.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Also on this visit, not on the bench yet:{' '}
            {notYetOnBench
              .map((sheet) => `${testOf(sheet)?.testName || 'Test'} (${sampleOf(sheet).status || 'Pending'})`)
              .join(', ')}
            . They open here once they reach Processing. The patient&apos;s report is generated only after every test
            is released.
          </span>
        </div>
      )}

      {sheets.map((sheet) => {
        const parameters = parametersOf(sheet);
        const test = testOf(sheet);
        const sample = sampleOf(sheet);
        const isOpenedSample = String(sample._id || sample.id) === String(sampleId);

        return (
          <Card key={sheet._id} className={isOpenedSample ? 'border-blue-300' : undefined}>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base font-bold">
                <span>
                  {test?.testName || 'Parameter Analysis Grid'}
                  {test?.testCode && (
                    <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
                      ({test.testCode})
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <span className="font-mono">{sample.sampleId}</span>
                  <Badge variant={isReleased(sheet) ? 'success' : 'amber'}>
                    {isReleased(sheet) && <Lock className="mr-1 h-3 w-3" />}
                    {sheet.status === 'Submitted' ? 'Saved - awaiting approval' : sheet.status}
                  </Badge>
                  <span>
                    {filledCount(sheet)} of {entryRowsOf(sheet).length} filled
                  </span>
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {/* A locked sheet is read-only: every control inside is disabled. */}
              <fieldset disabled={isLocked(sheet)} className="min-w-0 disabled:opacity-80">
              {parameters.length === 0 ? (
                <div className="m-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    No parameters are set up for this test, so there is nothing to enter and the report would
                    print empty. Add them under Masters &rsaquo; Tests &rsaquo; Parameters, then re-open this
                    sample.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b bg-muted/50 font-semibold">
                      <tr>
                        <th className="p-3">Parameter Name</th>
                        <th className="p-3">Result Value</th>
                        <th className="p-3">Unit</th>
                        <th className="p-3">Reference Range</th>
                        <th className="p-3">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parameters.map((p: any, idx: number) => {
                        if (p.resultType === 'Header') {
                          return (
                            <tr key={idx} className="bg-muted/40">
                              <td colSpan={5} className="p-2 px-3 font-bold uppercase tracking-wide text-blue-700">
                                {p.parameterName}
                              </td>
                            </tr>
                          );
                        }

                        const value = valueOf(sheet, p);
                        const formula = formulaOf(sheet, p);
                        const calculated = isCalculated(sheet, p);
                        const manualFlag = manualFlagOf(sheet, p);
                        const autoFlag = previewFlag(value, p.referenceRange, p);
                        const flag = flagOf(sheet, p);
                        const options =
                          p.resultType === 'Dropdown' ? p.dropdownOptions : OPTIONS_BY_TYPE[p.resultType];

                        return (
                          <tr key={idx}>
                            <td className="p-3 font-bold">
                              {p.parameterName}
                              {p.shortName && (
                                <span className="ml-1 font-normal text-muted-foreground">({p.shortName})</span>
                              )}
                              {formula && (
                                <span
                                  className="ml-1.5 rounded bg-violet-100 px-1 text-[10px] font-bold italic text-violet-700"
                                  title={`Calculated: ${formula}`}
                                >
                                  ƒ calc
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {options && options.length ? (
                                <select
                                  className={selectClass}
                                  value={value}
                                  onChange={(e) => setValue(sheet._id, p.parameterName, e.target.value)}
                                >
                                  <option value="">Select</option>
                                  {options.map((opt: string) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={value}
                                    onChange={(e) => {
                                      if (formula) setOverride(sheet._id, p.parameterName, true);
                                      setValue(sheet._id, p.parameterName, e.target.value);
                                    }}
                                    className={`h-8 font-mono ${calculated ? 'border-violet-200 bg-violet-50/60 text-violet-900' : ''}`}
                                    placeholder={
                                      calculated
                                        ? 'Fills in from the other values'
                                        : p.resultType === 'Numeric'
                                        ? '0.0'
                                        : 'Type the finding'
                                    }
                                    title={calculated ? `Calculated: ${formula} - type to override` : undefined}
                                  />
                                  {formula && !calculated && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOverride(sheet._id, p.parameterName, false);
                                        setValue(sheet._id, p.parameterName, '');
                                      }}
                                      className="shrink-0 rounded p-1 text-violet-600 hover:bg-violet-50"
                                      title={`Typed by hand - click to calculate again (${formula})`}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{p.unit || '-'}</td>
                            <td className="p-3 font-mono text-muted-foreground">{p.referenceRange || '-'}</td>
                            <td className="p-3">
                              {String(value).trim() === '' ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant={flagVariant(flag)}>
                                    {flag}
                                    {manualFlag && <span className="ml-1 opacity-75">(manual)</span>}
                                  </Badge>
                                  <select
                                    className={`${selectClass} w-28`}
                                    value={manualFlag}
                                    title="Leave on Auto to read the flag off the range, or pick one to override it"
                                    onChange={(e) => setManualFlag(sheet._id, p.parameterName, e.target.value)}
                                  >
                                    <option value="">Auto ({autoFlag})</option>
                                    {FLAG_CHOICES.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {parameters.length > 0 && (
                <div className="border-t p-3">
                  <label className="mb-1 block text-xs font-semibold">
                    Remarks for {test?.testName || 'this test'}
                  </label>
                  <textarea
                    value={remarksOf(sheet)}
                    onChange={(e) => setRemarks((prev) => ({ ...prev, [sheet._id]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Anything the pathologist should read alongside these values."
                  />
                </div>
              )}
              </fieldset>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          {!allLocked && (
            <Button
              disabled={sheetsWithValues().length === 0 || submitMutation.isPending}
              isLoading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700"
              title="Save the values - the pathologist then approves and signs the report"
            >
              <Save className="mr-1 h-4 w-4" /> Save{dirtyCount > 0 ? ` (${dirtyCount} changed)` : ''}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!anySaved}
            onClick={() => navigate(`/results/report/${sheets[0]._id}`)}
            title={anySaved ? 'Open the report' : 'Save the values first'}
          >
            <Eye className="mr-1 h-4 w-4" />{' '}
            {sheets.every(isReleased) ? 'View Final Report' : 'View Provisional Report'}
          </Button>
        </div>

        {canVerify && !allLocked && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-red-500"
                disabled={sheetsWithValues().length === 0 || verifyMutation.isPending}
                onClick={() => verifyMutation.mutate('Reject')}
              >
                <XCircle className="mr-1 h-4 w-4" /> Reject Result
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={sheetsWithValues().length === 0 || verifyMutation.isPending}
                onClick={() => verifyMutation.mutate('Approve')}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve &amp; Release
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              {sheetsWithValues().length === 0
                ? anyReleased
                  ? 'Approved already - change a value to approve a correction.'
                  : 'Fill in at least one parameter before this can be approved.'
                : `Approving signs the report and locks it (${sheetsWithValues().length} of ${sheets.length} test${
                    sheets.length === 1 ? '' : 's'
                  }).`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
