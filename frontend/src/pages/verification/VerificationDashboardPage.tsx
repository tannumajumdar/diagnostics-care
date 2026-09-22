import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resultApi } from '../../api/result.api';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { useToast } from '../../context/ToastContext';
import { ResultRecord } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ShieldCheck, Eye, Clock, CheckCircle2, AlertTriangle, Siren, FlaskConical, Inbox } from 'lucide-react';

/** A patient's report as it waits in the queue: the visit, and its tests. */
type QueuedReport = {
  key: string;
  sheets: ResultRecord[];
  patientName: string;
  uhid: string;
  submittedAt: string;
  technician: string;
  status: string;
  testNames: string[];
  abnormal: number;
  critical: number;
};

const idOf = (value: any): string =>
  typeof value === 'object' && value !== null ? String(value._id || value.id || '') : String(value || '');

export const VerificationDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  /**
   * The worklist is re-read every time the pathologist opens it.
   *
   * Everything in the app is cached for five minutes, which is right for a
   * list being paged through and wrong for a queue: a report the bench sent
   * up a minute ago has to be on this screen the moment it is opened, not
   * when a timer expires.
   */
  const { data, isLoading } = useQuery({
    queryKey: ['results-verification-queue'],
    queryFn: () => resultApi.getPending(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  /**
   * The queue endpoint sends `data` as a bare array, which the page was reading
   * as `data.results`. That key does not exist, so the count came back zero and
   * the pathologist was told the queue was empty however many results the
   * bench had submitted into it.
   */
  const queue = asList<ResultRecord>(data, 'results');

  /**
   * One row per report, not per test.
   *
   * A visit billed for three tests is one document with three sections - it is
   * printed that way and handed over that way - so it waits here as one line
   * the pathologist releases in one go. Three rows for the same patient was a
   * list they had to tell apart by result id.
   */
  const reports: QueuedReport[] = React.useMemo(() => {
    const groups = new Map<string, ResultRecord[]>();

    for (const sheet of queue) {
      // The invoice is the visit. A sheet somehow without one stands alone
      // rather than being lumped in with another patient's report.
      const key = idOf(sheet.invoice) || `result:${sheet._id}`;
      groups.set(key, [...(groups.get(key) || []), sheet]);
    }

    return Array.from(groups.entries()).map(([key, sheets]) => {
      const first: any = sheets[0];
      const patient = typeof first.patient === 'object' ? first.patient : {};
      const parameters = sheets.flatMap((s) => s.results || []);

      return {
        key,
        sheets,
        patientName: patient.patientName || 'N/A',
        uhid: first.uhid,
        submittedAt: sheets.map((s) => s.updatedAt || s.createdAt).sort().slice(-1)[0],
        technician: first.enteredBy?.name || 'Technician',
        status: first.status,
        testNames: sheets.map((s: any) => (typeof s.test === 'object' ? s.test?.testName : '') || 'Test'),
        abnormal: parameters.filter((p) => p.flag && p.flag !== 'Normal').length,
        critical: parameters.filter((p) => p.flag === 'Critical').length,
      };
    });
  }, [queue]);

  /**
   * Approving from here releases the whole report - every test the patient is
   * waiting on - so the pathologist does not have to open the entry screen for
   * a run they have already read on this page.
   */
  const approveMutation = useMutation({
    mutationFn: async (report: QueuedReport) => {
      for (const sheet of report.sheets) {
        await resultApi.verify(sheet._id, { action: 'Approve' });
      }
      return report;
    },
    onSuccess: (report) => {
      // Releasing a report takes the specimen to Completed, so every bench
      // queue it was sitting in has to be re-read alongside this one.
      LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      showToast(
        `${report.patientName}'s report approved and released (${report.sheets.length} test${
          report.sheets.length === 1 ? '' : 's'
        })`,
        'success'
      );
    },
    onError: (err: any) => showToast(err?.message || 'Could not approve this report', 'error'),
  });

  const approving = (report: QueuedReport) =>
    approveMutation.isPending && approveMutation.variables?.key === report.key;

  /**
   * What the queue adds up to. A pathologist opening this screen wants to know
   * whether there is a critical value waiting before they start reading down
   * the list - that should not require scanning every row for red text.
   */
  const totals = React.useMemo(
    () => ({
      reports: reports.length,
      tests: reports.reduce((sum, r) => sum + r.sheets.length, 0),
      abnormal: reports.reduce((sum, r) => sum + r.abnormal, 0),
      critical: reports.reduce((sum, r) => sum + r.critical, 0),
    }),
    [reports]
  );

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">Verification</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Verification Desk</h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Read the bench's parameter entries, weigh the flags, and release the report to the front desk.
          </p>

          <div className="mt-5">
            <span className="text-[44px] font-semibold leading-none tracking-tight sm:text-5xl">
              {isLoading ? '—' : totals.reports}
            </span>
            <p className="mt-2 text-xs font-medium text-slate-300">
              Report{totals.reports === 1 ? '' : 's'} awaiting your sign-off
            </p>
            <p className="text-[11px] text-slate-500">
              {totals.tests} test{totals.tests === 1 ? '' : 's'} in the queue
              {totals.critical > 0 && ` · ${totals.critical} critical value${totals.critical === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Reports waiting',
            value: totals.reports,
            icon: Inbox,
            rail: 'bg-violet-500',
            chip: 'bg-violet-50 text-violet-600',
          },
          {
            label: 'Tests to read',
            value: totals.tests,
            icon: FlaskConical,
            rail: 'bg-blue-500',
            chip: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Outside range',
            value: totals.abnormal,
            icon: AlertTriangle,
            rail: 'bg-amber-500',
            chip: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Critical values',
            value: totals.critical,
            icon: Siren,
            rail: 'bg-rose-500',
            chip: 'bg-rose-50 text-rose-600',
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <span className={`absolute inset-y-0 left-0 w-[3px] ${tile.rail} opacity-70`} />
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tile.chip}`}>
              <tile.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-slate-500">{tile.label}</p>
              <p className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
                {isLoading ? '—' : tile.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-sm font-semibold text-slate-900">Submitted reports pending verification</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3 font-semibold">Report</th>
                  <th className="p-3 font-semibold">Patient &amp; UHID</th>
                  <th className="p-3 font-semibold">Tests</th>
                  <th className="p-3 font-semibold">Submitted</th>
                  <th className="p-3 font-semibold">Technician</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading verification queue...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </span>
                        <p className="text-sm font-semibold text-slate-700">Queue is clear</p>
                        <p className="text-xs text-slate-400">
                          Nothing is waiting on your sign-off. New submissions appear here as the bench sends them up.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.key} className="transition-colors hover:bg-slate-50/60">
                      <td className="p-3 font-mono font-bold text-blue-600">
                        {report.sheets.map((s) => (
                          <div key={s._id}>{s.resultId}</div>
                        ))}
                      </td>
                      <td className="p-3 font-bold">
                        <div>{report.patientName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">UHID: {report.uhid}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{report.testNames.join(', ')}</div>
                        {/* What is actually being released - a pathologist
                            approving off this page should not have to open the
                            sheet to learn there is a critical value on it. */}
                        {report.abnormal > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {/* Icon and word both carry the state - a colour
                                on its own is not readable by everyone. */}
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {report.abnormal} outside range
                            </span>
                            {report.critical > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                <Siren className="h-2.5 w-2.5" />
                                {report.critical} critical
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '-'}
                      </td>
                      <td className="p-3 font-semibold">{report.technician}</td>
                      <td className="p-3">
                        <Badge variant="amber">{report.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/results/entry/${idOf(report.sheets[0].sample)}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> Review
                          </Button>
                          <Button
                            size="sm"
                            disabled={approveMutation.isPending}
                            isLoading={approving(report)}
                            onClick={() => approveMutation.mutate(report)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Approving releases the report to the front desk. Open Review to send a run back to the bench instead.
      </p>
    </div>
  );
};

export default VerificationDashboardPage;
