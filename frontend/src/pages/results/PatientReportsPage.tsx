import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resultApi } from '../../api/result.api';
import { asList } from '../../utils/api-list';
import { resultMarker } from '../../utils/result-flag';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DateInput } from '../../components/ui/date-input';
import {
  FileText,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
} from 'lucide-react';

const STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Final'];

const dateTime = (value?: string | Date) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

const statusVariant = (status?: string) =>
  status === 'Approved' || status === 'Final'
    ? 'success'
    : status === 'Rejected'
    ? 'destructive'
    : status === 'Draft'
    ? 'secondary'
    : 'amber';

/** A section title with nothing typed beneath it before the next one says nothing. */
const withoutEmptyHeaders = (rows: any[]) =>
  rows.filter(
    (row, i) => row.resultType !== 'Header' || (rows[i + 1] && rows[i + 1].resultType !== 'Header')
  );

const isAbnormal = (p: any) => p.resultType !== 'Header' && p.flag && p.flag !== 'Normal';

/**
 * The register of every patient's report - one card per visit, with the
 * values the bench typed against each test. Opened by the Admin and the
 * Pathologist to look a result up without walking the verification queue.
 */
export const PatientReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['patient-reports', searchTerm, status, from, to, page],
    queryFn: () =>
      resultApi.getPatientReports({
        search: searchTerm || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 10,
      }),
  });

  const reports = asList<any>(data, 'reports');
  const total = data?.meta?.total ?? reports.length;
  const totalPages = data?.meta?.totalPages || 1;

  const resetPage = () => setPage(1);
  const hasFilters = Boolean(searchTerm || status || from || to);
  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <FileText className="h-6 w-6 text-blue-600" />
          <span>Patient Reports</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every patient&apos;s entered test results, grouped by visit.
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient name, mobile, UHID, enquiry no..."
            className="pl-9 text-xs"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchTerm(e.target.value);
              resetPage();
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>From</span>
          <DateInput
            className="w-36"
            value={from}
            max={to || undefined}
            onChange={(iso) => {
              setFrom(iso);
              resetPage();
            }}
          />
          <span>To</span>
          <DateInput
            className="w-36"
            value={to}
            min={from || undefined}
            onChange={(iso) => {
              setTo(iso);
              resetPage();
            }}
          />
        </div>
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setStatus('');
              setFrom('');
              setTo('');
              resetPage();
            }}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
        <div className="text-xs text-muted-foreground lg:ml-auto">
          <strong>{total}</strong> visit{total === 1 ? '' : 's'}
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">Loading patient reports...</Card>
      ) : isError ? (
        <Card className="p-8 text-center text-xs">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-600" />
          {(error as any)?.message || 'Patient reports could not be loaded.'}
        </Card>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">No patient reports found.</Card>
      ) : (
        <div className="space-y-4">
          {reports.map((visit: any) => {
            const patient = typeof visit.patient === 'object' && visit.patient ? visit.patient : {};
            const tests = asList<any>(visit.tests);
            const open = expanded[visit._id] ?? true;
            const readiness = visit.readiness || { isReady: false, completed: 0, total: tests.length, pending: [] };
            const abnormal = tests.reduce(
              (n: number, t: any) => n + asList<any>(t.results).filter(isAbnormal).length,
              0
            );

            return (
              <Card key={visit._id} className="overflow-hidden border">
                <button
                  type="button"
                  onClick={() => toggle(visit._id)}
                  className="flex w-full flex-col gap-2 border-b bg-muted/40 p-4 text-left text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground">
                      {patient.patientName || 'N/A'}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {[patient.age && `${patient.age} Y`, patient.gender]
                          .filter(Boolean)
                          .join(' / ')}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <span className="font-mono">UHID: {visit.uhid || '-'}</span>
                      {visit.enquiryNo && <span className="font-mono">Enq: {visit.enquiryNo}</span>}
                      {visit.invoiceNumber && <span className="font-mono">Bill: {visit.invoiceNumber}</span>}
                      {patient.mobile && <span>Mob: {patient.mobile}</span>}
                      <span>Ref: {visit.referredBy}</span>
                      <span>Updated: {dateTime(visit.lastUpdated)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {readiness.isReady ? (
                      <Badge variant="success">Report ready</Badge>
                    ) : (
                      <Badge variant="amber">
                        Report pending · {readiness.completed}/{readiness.total} done
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {readiness.total || tests.length} test{(readiness.total || tests.length) === 1 ? '' : 's'}
                    </Badge>
                    {abnormal > 0 && <Badge variant="destructive">{abnormal} abnormal</Badge>}
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {open && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-xs">
                    {readiness.isReady ? (
                      <span className="text-muted-foreground">
                        Every test on this visit is released - the report can be printed.
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        Waiting on:{' '}
                        {asList<any>(readiness.pending)
                          .map((p: any) => `${p.testName} (${p.stage})`)
                          .join(', ')}
                      </span>
                    )}
                    <Button
                      size="sm"
                      disabled={!readiness.isReady || !tests[0]}
                      title={
                        readiness.isReady
                          ? 'Open the patient report'
                          : 'The report is generated once every test on the visit is released'
                      }
                      onClick={() => navigate(`/results/report/${tests[0]._id}`)}
                    >
                      <Eye className="mr-1 h-4 w-4" /> Patient Report
                    </Button>
                  </div>
                )}

                {open && (
                  <div className="divide-y">
                    {tests.map((test: any) => {
                      const rows = withoutEmptyHeaders(asList<any>(test.results));
                      return (
                        <div key={test._id} className="p-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-sm font-semibold text-foreground">{test.testName}</span>
                              {test.department && (
                                <span className="text-muted-foreground">({test.department})</span>
                              )}
                              <Badge variant={statusVariant(test.status)}>{test.status}</Badge>
                              <span className="font-mono text-muted-foreground">{test.resultId}</span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead className="border-b bg-muted/30 font-semibold text-muted-foreground">
                                <tr>
                                  <th className="p-2">Parameter</th>
                                  <th className="p-2">Result</th>
                                  <th className="p-2">Unit</th>
                                  <th className="p-2">Reference Range</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {rows.map((p: any, i: number) => {
                                  if (p.resultType === 'Header') {
                                    return (
                                      <tr key={`${p.parameterName}-${i}`}>
                                        <td colSpan={4} className="p-2 font-semibold uppercase text-foreground">
                                          {p.parameterName}
                                        </td>
                                      </tr>
                                    );
                                  }
                                  const marker = resultMarker(p);
                                  return (
                                    <tr key={`${p.parameterName}-${i}`}>
                                      <td className="p-2">{p.parameterName}</td>
                                      <td
                                        className={`p-2 font-semibold ${
                                          marker ? (marker.critical ? 'text-red-700' : 'text-red-600') : ''
                                        }`}
                                      >
                                        {p.value}
                                        {marker && (
                                          <span className="ml-1" title={marker.title}>
                                            {marker.text}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 text-muted-foreground">{p.unit || '-'}</td>
                                      <td className="whitespace-pre-line p-2 text-muted-foreground">
                                        {p.referenceRange || '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {test.overallRemarks && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <strong>Remarks:</strong> {test.overallRemarks}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
                            <span>Entered by: {test.enteredBy?.name || '-'}</span>
                            {test.verifiedBy?.name && (
                              <span>
                                Verified by: {test.verifiedBy.name} on {dateTime(test.verifiedBy.date)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
