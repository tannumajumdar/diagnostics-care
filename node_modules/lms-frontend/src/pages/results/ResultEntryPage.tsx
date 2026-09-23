import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { resultApi } from '../../api/result.api';
import { ParameterResult } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Save, Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ageLabel } from '../../utils/age';

const selectClass =
  'flex h-8 w-full rounded-lg border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Reads the flag off a typed value the same way the server does, so the bench
 * sees a value go red as it is typed instead of after the save round-trips.
 * The server still recalculates on save - this is a preview, not the record.
 */
const previewFlag = (value: string, range?: string, criticalLow?: string, criticalHigh?: string) => {
  const val = parseFloat(value);
  if (isNaN(val)) return 'Normal';

  const low = parseFloat(String(criticalLow ?? ''));
  const high = parseFloat(String(criticalHigh ?? ''));
  if (!isNaN(low) && val < low) return 'Critical';
  if (!isNaN(high) && val > high) return 'Critical';

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

  // Typed values and remarks, keyed by the sheet they belong to, so two tests
  // that measure a parameter of the same name never overwrite each other.
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['result-entry-visit', sampleId],
    queryFn: () => resultApi.getVisitBySampleId(sampleId!),
    enabled: !!sampleId,
  });

  const sheets = asList<any>(data, 'results');

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

  const valueOf = (sheet: any, p: any) => {
    const typed = values[sheet._id]?.[p.parameterName];
    return typed !== undefined ? typed : p.value || '';
  };

  const remarksOf = (sheet: any) =>
    remarks[sheet._id] !== undefined ? remarks[sheet._id] : sheet.overallRemarks || '';

  const setValue = (sheetId: string, parameterName: string, val: string) =>
    setValues((prev) => ({ ...prev, [sheetId]: { ...(prev[sheetId] || {}), [parameterName]: val } }));

  const filledCount = (sheet: any) =>
    parametersOf(sheet).filter((p: any) => String(valueOf(sheet, p)).trim() !== '').length;

  const payloadFor = (sheet: any): ParameterResult[] =>
    parametersOf(sheet).map((p: any) => ({ ...p, value: valueOf(sheet, p) }));

  /** Sheets worth writing back - anything with a value typed or already held. */
  const sheetsWithValues = () => sheets.filter((sheet) => filledCount(sheet) > 0);

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

  const draftMutation = useMutation({
    mutationFn: () => saveAll('draft'),
    onSuccess: (targets) => {
      invalidate();
      if (targets.length) showToast(`Draft saved for ${targets.length} test(s)`, 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Could not save the draft', 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: () => saveAll('submit'),
    onSuccess: (targets) => {
      invalidate();
      if (!targets.length) return;
      showToast(`${targets.length} test(s) sent to the pathologist`, 'success');
      navigate('/results');
    },
    onError: (err: any) => showToast(err?.message || 'Could not submit the result', 'error'),
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
      return targets;
    },
    onSuccess: (targets, action) => {
      invalidate();
      showToast(
        action === 'Approve'
          ? `${targets.length} test(s) approved and released`
          : `${targets.length} test(s) sent back to the bench`,
        'success'
      );
      navigate('/results/pending');
    },
    onError: (err: any) => showToast(err?.message || 'Could not update the verification', 'error'),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading parameter entry interface...</div>;
  if (!sheets.length)
    return <div className="p-8 text-center font-semibold text-muted-foreground">Result record not found for sample.</div>;

  const patient = typeof sheets[0].patient === 'object' ? sheets[0].patient : {};
  const totalFilled = sheets.reduce((sum, sheet) => sum + filledCount(sheet), 0);
  const totalParameters = sheets.reduce((sum, sheet) => sum + parametersOf(sheet).length, 0);
  // An already-released report stays editable on purpose: a wrong or missing
  // value has to be correctable. Saving sends it back to Draft, so the
  // pathologist has to look at it again before it can be handed over.
  const anyReleased = sheets.some((s) => s.status === 'Approved' || s.status === 'Final');

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
            {sheets.length} test{sheets.length === 1 ? '' : 's'} on this visit
          </p>
          <p className="text-[12px] text-muted-foreground">
            {totalFilled} of {totalParameters} values filled
          </p>
        </div>
      </div>

      {anyReleased && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            One of these reports has already been released. Editing and saving it pulls it back to Draft, so the
            pathologist has to verify it again before the patient can be given the corrected copy.
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
                  <Badge variant={sheet.status === 'Approved' ? 'success' : 'amber'}>{sheet.status}</Badge>
                  <span>
                    {filledCount(sheet)} of {parameters.length} filled
                  </span>
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
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
                        const value = valueOf(sheet, p);
                        const flag = previewFlag(value, p.referenceRange, p.criticalLow, p.criticalHigh);
                        const options =
                          p.resultType === 'Dropdown' ? p.dropdownOptions : OPTIONS_BY_TYPE[p.resultType];

                        return (
                          <tr key={idx}>
                            <td className="p-3 font-bold">
                              {p.parameterName}
                              {p.shortName && (
                                <span className="ml-1 font-normal text-muted-foreground">({p.shortName})</span>
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
                                <Input
                                  value={value}
                                  onChange={(e) => setValue(sheet._id, p.parameterName, e.target.value)}
                                  className="h-8 font-mono"
                                  placeholder={p.resultType === 'Numeric' ? '0.0' : 'Type the finding'}
                                />
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{p.unit || '-'}</td>
                            <td className="p-3 font-mono text-muted-foreground">{p.referenceRange || '-'}</td>
                            <td className="p-3">
                              {String(value).trim() === '' ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <Badge variant={flagVariant(flag)}>{flag}</Badge>
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
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={totalParameters === 0 || draftMutation.isPending}
            isLoading={draftMutation.isPending}
            onClick={() => draftMutation.mutate()}
          >
            <Save className="mr-1 h-4 w-4" /> Save Draft
          </Button>
          <Button
            disabled={totalFilled === 0 || submitMutation.isPending}
            isLoading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="mr-1 h-4 w-4" /> Submit {sheets.length > 1 ? 'all' : ''} for Verification
          </Button>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-red-500"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate('Reject')}
            >
              <XCircle className="mr-1 h-4 w-4" /> Reject Result
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={totalFilled === 0 || verifyMutation.isPending}
              onClick={() => verifyMutation.mutate('Approve')}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve &amp; Release
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {totalFilled === 0 && totalParameters > 0
              ? 'Fill in at least one parameter before this can be approved.'
              : `Acts on every test on this visit that has values typed in (${sheetsWithValues().length} of ${
                  sheets.length
                }).`}
          </p>
        </div>
      </div>
    </div>
  );
};
