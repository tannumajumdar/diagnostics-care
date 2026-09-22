import React, { useState } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { sampleApi } from '../../api/sample.api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { STAGES, REJECTION_REASONS, canAdvance, type StageMeta } from '../../config/workflow';
import { Button } from '../../components/ui/button';
import { Workflow, Search, X, AlertTriangle, RotateCcw, Clock, ArrowRight, History } from 'lucide-react';

const inputClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const fmtTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Remaining turnaround, or how far past target the sample already is. */
const tatLabel = (expectedAt?: string, done?: boolean) => {
  if (!expectedAt || done) return null;
  const diff = new Date(expectedAt).getTime() - Date.now();
  const mins = Math.round(Math.abs(diff) / 60000);
  const text = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return diff < 0 ? { text: `${text} overdue`, overdue: true } : { text: `${text} left`, overdue: false };
};

export const LabWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [reasonNote, setReasonNote] = useState('');
  const [timelineFor, setTimelineFor] = useState<string | null>(null);

  const { data: stats } = useQuery({ queryKey: ['sample-stats'], queryFn: () => sampleApi.getStats() });

  // One query per column so each lane loads independently of the others.
  const laneQueries = useQueries({
    queries: STAGES.map((meta) => ({
      queryKey: ['workflow', meta.stage, applied],
      queryFn: () => sampleApi.getAll({ status: meta.stage, search: applied || undefined, limit: 25 }),
    })),
  });
  const lanes = STAGES.map((meta, i) => ({ meta, query: laneQueries[i] }));

  const { data: rejectedData } = useQuery({
    queryKey: ['workflow', 'Rejected', applied],
    queryFn: () => sampleApi.getAll({ status: 'Rejected', search: applied || undefined, limit: 25 }),
  });
  const rejected = asList<any>(rejectedData, 'samples');

  const { data: timeline } = useQuery({
    queryKey: ['sample-timeline', timelineFor],
    queryFn: () => sampleApi.getTimeline(timelineFor!),
    enabled: !!timelineFor,
  });

  const refresh = () => {
    // Every queue the specimen could have moved between, not just the board
    // it was moved on.
    LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const advance = async (sample: any, meta: StageMeta) => {
    if (meta.entryRoute) {
      navigate(`/results/entry/${sample.id}`);
      return;
    }
    if (!meta.next) return;
    setBusyId(sample.id);
    try {
      await sampleApi.updateStatus(sample.id, { status: meta.next });
      showToast(`${sample.sampleId} → ${meta.next}`, 'success');
      refresh();
    } catch (err: any) {
      // The backend state machine is the authority; surface its reason verbatim.
      showToast(err?.message || 'Could not advance sample', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    setBusyId(rejectFor.id);
    try {
      await sampleApi.reject(rejectFor.id, { rejectionReason: reason, rejectionRemarks: reasonNote });
      showToast(`${rejectFor.sampleId} rejected — ${reason}`, 'success');
      setRejectFor(null);
      setReasonNote('');
      refresh();
    } catch (err: any) {
      showToast(err?.message || 'Could not reject sample', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const recollect = async (sample: any) => {
    setBusyId(sample.id);
    try {
      await sampleApi.recollect(sample.id, { remarks: 'Repeat draw ordered' });
      showToast(`${sample.sampleId} re-queued for collection`, 'success');
      refresh();
    } catch (err: any) {
      showToast(err?.message || 'Could not order repeat draw', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const runSearch = () => setApplied(search.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <Workflow className="h-6 w-6 text-blue-600" />
            <span>Lab Workflow</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Every specimen from the draw to the released report. A sample can only move one step at a time.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} pl-8`}
              placeholder="Sample ID, barcode, UHID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
          </div>
          <Button onClick={runSearch} className="h-9 bg-blue-600 hover:bg-blue-700">
            Search
          </Button>
          {applied && (
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                setSearch('');
                setApplied('');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {(stats?.overdue ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {stats.overdue} sample(s) past their turnaround target and still unreported.
          </span>
        </div>
      )}

      {/* Pipeline board */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {lanes.map(({ meta, query }) => {
          const samples = asList<any>(query.data, 'samples');
          const total = query.data?.meta?.total ?? samples.length;
          const Icon = meta.icon;
          const allowed = canAdvance(meta.stage, user?.role);

          return (
            <section key={meta.stage} className="flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-slate-50/60">
              <header className={`rounded-t-2xl border-b px-3 py-2.5 ${meta.accent}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-slate-600" />
                    <h2 className="text-xs font-semibold text-slate-900">{meta.short}</h2>
                  </div>
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                    {total}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-600">{meta.detail}</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">{meta.owner}</p>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                {query.isLoading ? (
                  <p className="py-6 text-center text-[11px] text-slate-400">Loading…</p>
                ) : samples.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-slate-400">Nothing here.</p>
                ) : (
                  samples.map((s: any) => {
                    const tat = tatLabel(s.expectedAt, meta.stage === 'Completed');
                    return (
                      <article
                        key={s.id}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">{s.testName}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              {typeof s.patient === 'object' ? s.patient?.patientName ?? '—' : '—'}
                            </p>
                          </div>
                          <button
                            onClick={() => setTimelineFor(s.id)}
                            className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="View timeline"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="mt-1 font-mono text-[10px] text-slate-400">{s.sampleId}</p>

                        {(s.recollectionCount ?? 0) > 0 && (
                          <span className="mt-1 inline-block rounded bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">
                            Repeat draw ×{s.recollectionCount}
                          </span>
                        )}

                        {tat && (
                          <p
                            className={`mt-1 text-[10px] font-medium ${
                              tat.overdue ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            {tat.text}
                          </p>
                        )}

                        {(meta.next || meta.entryRoute) && (
                          <div className="mt-2 flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 flex-1 gap-1 bg-slate-900 px-2 text-[10px] hover:bg-slate-800"
                              disabled={!allowed || busyId === s.id}
                              onClick={() => advance(s, meta)}
                              title={allowed ? meta.action : `${meta.owner} performs this step`}
                            >
                              <span className="truncate">{meta.action}</span>
                              <ArrowRight className="h-3 w-3 shrink-0" />
                            </Button>
                            <button
                              onClick={() => setRejectFor(s)}
                              disabled={!allowed || busyId === s.id}
                              className="rounded-lg border border-slate-200 px-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                              aria-label="Reject sample"
                              title="Reject sample"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Rejected lane */}
      {rejected.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h2 className="text-sm font-semibold text-slate-900">Rejected — awaiting repeat draw</h2>
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
              {rejected.length}
            </span>
          </header>
          <ul className="divide-y divide-slate-100">
            {rejected.map((s: any) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {s.testName}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">{s.sampleId}</span>
                  </p>
                  <p className="truncate text-[11px] text-rose-600">{s.rejectionReason || 'Rejected'}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  disabled={busyId === s.id}
                  onClick={() => recollect(s)}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Order repeat draw</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reject dialog */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Reject sample</h3>
              <button onClick={() => setRejectFor(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-xs text-slate-500">
                {rejectFor.testName} · <span className="font-mono">{rejectFor.sampleId}</span>
              </p>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Reason
                </label>
                <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REJECTION_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Notes (optional)
                </label>
                <input
                  className={inputClass}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Anything the phlebotomist should know"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="outline" className="h-9" onClick={() => setRejectFor(null)}>
                Cancel
              </Button>
              <Button className="h-9 bg-rose-600 hover:bg-rose-700" onClick={submitReject}>
                Reject sample
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline drawer */}
      {timelineFor && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={() => setTimelineFor(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Specimen timeline</h3>
              <button onClick={() => setTimelineFor(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!timeline ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">Loading…</p>
            ) : (
              <div className="space-y-5 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{timeline.sample?.testName}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {timeline.sample?.sampleId} · {timeline.sample?.barcode}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {typeof timeline.sample?.patient === 'object'
                      ? timeline.sample.patient?.patientName
                      : ''}{' '}
                    · {timeline.sample?.uhid}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stages</p>
                  <ol className="space-y-0">
                    {timeline.stages?.map((s: any, i: number) => (
                      <li key={s.stage} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${
                              s.state === 'done'
                                ? 'bg-emerald-500 ring-emerald-100'
                                : s.state === 'current'
                                ? 'bg-blue-600 ring-blue-100'
                                : 'bg-slate-200 ring-slate-100'
                            }`}
                          />
                          {i < timeline.stages.length - 1 && (
                            <span className={`w-px flex-1 ${s.state === 'done' ? 'bg-emerald-200' : 'bg-slate-150'}`} />
                          )}
                        </div>
                        <div className="pb-4">
                          <p
                            className={`text-xs font-medium ${
                              s.state === 'pending' ? 'text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {s.stage}
                          </p>
                          <p className="text-[10px] text-slate-400">{fmtTime(s.reachedAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {timeline.isRejected && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                    Rejected — {timeline.sample?.rejectionReason}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Audit trail</p>
                  <ul className="space-y-1.5">
                    {(timeline.history ?? []).map((h: any, i: number) => (
                      <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px]">
                        <p className="text-slate-900">
                          <span className="text-slate-400">{h.fromStatus ?? '—'}</span> → {h.toStatus}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {h.updatedBy?.name} ({h.updatedBy?.role}) · {fmtTime(h.timestamp)}
                        </p>
                        {h.notes && <p className="mt-0.5 text-[10px] text-slate-500">{h.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
