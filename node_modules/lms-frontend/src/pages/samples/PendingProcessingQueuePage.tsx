import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { sampleApi } from '../../api/sample.api';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { collectedLabel } from '../../utils/collection-time';
import { useToast } from '../../context/ToastContext';
import { SampleRecord } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FlaskConical, CheckCircle2, ClipboardEdit } from 'lucide-react';

/** Every stage a visit passes through on its way to the bench. */
const QUEUE_STATUSES = ['Pending Collection', 'Collected', 'Received', 'Processing'];

type Visit = { key: string; patient: any; uhid?: string; enquiryNo?: string; samples: SampleRecord[] };

const idOf = (v: any) => String(typeof v === 'object' && v ? v._id ?? v.id ?? '' : v ?? '');

const groupByVisit = (samples: SampleRecord[]): Visit[] => {
  const visits = new Map<string, Visit>();
  samples.forEach((s) => {
    const key = idOf(s.invoice) || (s as any).enquiryNo || `sample-${s._id}`;
    const visit = visits.get(key);
    if (visit) visit.samples.push(s);
    else
      visits.set(key, {
        key,
        patient: typeof s.patient === 'object' && s.patient ? s.patient : {},
        uhid: s.uhid,
        enquiryNo: (s as any).enquiryNo,
        samples: [s],
      });
  });
  return Array.from(visits.values());
};

/** Red until the test is on the bench, yellow while it runs. */
const testState = (status: string) =>
  status === 'Processing'
    ? { label: 'In process', className: 'border-amber-300 bg-amber-100 text-amber-800', dot: 'bg-amber-500' }
    : status === 'Pending Collection'
    ? { label: 'Not collected', className: 'border-rose-300 bg-rose-100 text-rose-800', dot: 'bg-rose-500' }
    : { label: 'Pending', className: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' };

export const PendingProcessingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // The whole visit, including tests still waiting on the draw, so the bench
  // can see what is missing before it starts.
  const { data, isLoading } = useQuery({
    queryKey: ['samples-processing'],
    queryFn: () => sampleApi.getAll({ status: QUEUE_STATUSES.join(','), limit: 300 }),
  });

  const visits = groupByVisit(asList<SampleRecord>(data, 'samples'))
    // A visit nobody has drawn yet belongs to the collection queue, not here.
    .filter((v) => v.samples.some((s) => s.status !== 'Pending Collection'));

  /**
   * Manual sign-off that the visit's specimens are all in and going on the
   * bench. Each sample still walks Collected → Received → Processing so every
   * stage is stamped in its audit trail.
   */
  const markDone = async (visit: Visit) => {
    setBusyKey(visit.key);
    let moved = 0;
    try {
      for (const s of visit.samples) {
        if (s.status === 'Collected') {
          await sampleApi.updateStatus(s._id, { status: 'Received' });
        }
        if (s.status === 'Collected' || s.status === 'Received') {
          await sampleApi.updateStatus(s._id, { status: 'Processing' });
          moved += 1;
        }
      }
      showToast(
        `${visit.patient.patientName || visit.samples[0].sampleId}: ${moved} test${moved === 1 ? '' : 's'} in process`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Could not start processing', 'error');
    } finally {
      setBusyKey(null);
      LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-purple-600" />
          <span>Central Laboratory Processing Queue</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          One row per patient visit. Once every test is collected, mark the visit Done to put it on the bench.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> In process
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Visit Worklist</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 font-semibold border-b">
              <tr>
                <th className="p-3">Patient & UHID</th>
                <th className="p-3">Tests</th>
                <th className="p-3">Progress</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Loading processing worklist...
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No specimen containers ready for bench analysis.
                  </td>
                </tr>
              ) : (
                visits.map((visit) => {
                  const notCollected = visit.samples.filter((s) => s.status === 'Pending Collection').length;
                  const waiting = visit.samples.filter((s) => s.status === 'Collected' || s.status === 'Received');
                  const inProcess = visit.samples.filter((s) => s.status === 'Processing').length;
                  const allCollected = notCollected === 0;
                  const allInProcess = inProcess === visit.samples.length;

                  return (
                    <tr key={visit.key} className="align-top hover:bg-muted/30">
                      <td className="p-3 font-bold">
                        <div>{visit.patient.patientName || 'N/A'}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          UHID: {visit.uhid}
                          {visit.enquiryNo ? ` · ${visit.enquiryNo}` : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <ul className="space-y-1.5">
                          {visit.samples.map((s) => {
                            const state = testState(s.status);
                            const drawn = collectedLabel(s);
                            return (
                              <li
                                key={s._id}
                                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2 py-1 ${state.className}`}
                              >
                                <span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
                                <span className="font-semibold">{s.testName}</span>
                                <span className="font-mono text-[10px] opacity-70">{s.sampleId}</span>
                                {s.processingMode === 'Outsource' && (
                                  <Badge variant="amber">Out{s.outsourceLab ? ` · ${s.outsourceLab}` : ''}</Badge>
                                )}
                                <span className="ml-auto text-[10px] font-semibold uppercase">{state.label}</span>
                                {drawn && (
                                  <span className="w-full pl-4 text-[10px] opacity-80">Collected {drawn}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="p-3 text-[11px] text-muted-foreground">
                        <div>
                          {visit.samples.length - notCollected}/{visit.samples.length} collected
                        </div>
                        <div>
                          {inProcess}/{visit.samples.length} in process
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {allInProcess ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/results/entry/${visit.samples[0]._id}`)}
                          >
                            <ClipboardEdit className="h-4 w-4 mr-1" /> Enter Results
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!allCollected || waiting.length === 0 || busyKey === visit.key}
                            onClick={() => markDone(visit)}
                            title={
                              allCollected
                                ? 'All tests collected - put them on the bench'
                                : `${notCollected} test(s) still to be collected`
                            }
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {busyKey === visit.key ? 'Working…' : 'Done'}
                          </Button>
                        )}
                        {!allCollected && (
                          <p className="mt-1 text-[10px] text-rose-600">{notCollected} not collected yet</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
