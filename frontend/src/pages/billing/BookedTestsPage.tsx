import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '../../api/billing.api';
import { departmentApi } from '../../api/department.api';
import { doctorApi } from '../../api/doctor.api';
import { organizationApi } from '../../api/organization.api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { CancelTestRefundModal } from '../../components/accounts/CancelTestRefundModal';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { asList } from '../../utils/api-list';
import { DATE_PRESETS, formatDay, formatDateTime, formatTime, relativeDayLabel, todayKey } from '../../utils/dates';
import { COLLECTION_METHODS, methodLabel } from '../../config/payment-methods';
import { exportToExcel } from '../../utils/excel-export';
import { useToast } from '../../context/ToastContext';
import { usePrintTarget } from '../../hooks/usePrintTarget';
import { ListPrintSheet } from '../../components/billing/ListPrintSheet';
import {
  FlaskConical,
  Search,
  Eye,
  Undo2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Download,
  Printer,
} from 'lucide-react';
import { WhatsAppIcon } from '../../components/common/WhatsAppIcon';
import { buildPatientMessage, openWhatsApp, toWhatsAppNumber } from '../../utils/whatsapp';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** One bill line as the server sends it. */
interface BookedTest {
  invoiceId: string;
  /** Set once the visit's final report is out - the result to open it by. */
  reportResultId?: string | null;
  invoiceNumber: string;
  enquiryNo?: string;
  barcode?: string;
  uhid: string;
  billedAt: string;
  paymentStatus: string;
  dueAmount: number;
  patient?: { patientName?: string; uhid?: string; mobile?: string };
  doctorName?: string;
  organizationName?: string;
  itemIndex: number;
  testName: string;
  testCode: string;
  departmentName: string;
  packageName?: string;
  processingMode?: 'In-house' | 'Outsource';
  rate: number;
  netAmount: number;
  cancelled: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  refundedAmount: number;
  sampleId?: string;
  sampleStatus?: string;
}

/** How many of one test were booked on one day. */
interface DayCount {
  day: string;
  testName: string;
  testCode?: string;
  departmentName?: string;
  count: number;
}

/** The day-wise counts, one entry per day with its tests, newest day first. */
const groupByDay = (counts: DayCount[]) => {
  const days: Array<{ day: string; total: number; tests: DayCount[] }> = [];
  for (const c of counts) {
    let entry = days[days.length - 1];
    if (!entry || entry.day !== c.day) {
      entry = { day: c.day, total: 0, tests: [] };
      days.push(entry);
    }
    entry.tests.push(c);
    entry.total += c.count;
  }
  return days;
};

const dayHeading = (key: string) => {
  const label = relativeDayLabel(key);
  const date = formatDay(`${key}T00:00:00`);
  return label === date ? date : `${label} · ${date}`;
};

/** Where the work is, in the buckets the server filters on. */
const STATUS_FILTERS = [
  { label: 'All statuses', value: '' },
  { label: 'Pending collection', value: 'Pending' },
  { label: 'Collected', value: 'Collected' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Report ready', value: 'Completed' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const PROCESSING_FILTERS = [
  { label: 'All work', value: '' },
  { label: 'In-house', value: 'In-house' },
  { label: 'Outsource', value: 'Outsource' },
];

const PAYMENT_FILTERS = [
  { label: 'Paid & unpaid', value: '' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Unpaid / due', value: 'Unpaid' },
];

const statusBadge = (row: BookedTest) => {
  if (row.cancelled) return { label: 'Cancelled', variant: 'destructive' as const };
  switch (row.sampleStatus) {
    case 'Collected':
    case 'Received':
      return { label: row.sampleStatus, variant: 'purple' as const };
    case 'Processing':
      return { label: 'Processing', variant: 'amber' as const };
    case 'Completed':
      return { label: 'Report ready', variant: 'success' as const };
    case 'Rejected':
      return { label: 'Rejected', variant: 'destructive' as const };
    default:
      return { label: 'Pending collection', variant: 'secondary' as const };
  }
};

const selectClass = (active: boolean) =>
  `h-9 rounded-lg border bg-background px-2 text-xs font-medium ${
    active ? 'border-blue-300 text-blue-700' : 'text-slate-600'
  }`;

export const BookedTestsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canCancel = hasPermission(user, PERMISSIONS.REFUND_ISSUE);

  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [processingMode, setProcessingMode] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [organization, setOrganization] = useState('');
  const [doctor, setDoctor] = useState('');
  const [cancelPreset, setCancelPreset] = useState<{ invoiceId: string; label: string; itemIndex: number } | null>(
    null
  );

  // Typing is debounced so every keystroke is not a round trip.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: departmentsData } = useQuery({
    queryKey: ['departments-filter'],
    queryFn: () => departmentApi.getAll({ limit: 200 }),
  });
  const departments = asList<any>(departmentsData, 'departments');

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-filter'],
    queryFn: () => doctorApi.getAll({ limit: 500 }),
  });
  const doctors = asList<any>(doctorsData, 'doctors');

  const { data: organizationsData } = useQuery({
    queryKey: ['organizations-filter'],
    queryFn: () => organizationApi.getAll({ limit: 500 }),
  });
  const organizations = asList<any>(organizationsData, 'organizations');

  // The filters in force, shared by the list, the export and the print.
  const filters = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    status: status || undefined,
    department: department || undefined,
    processingMode: processingMode || undefined,
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    organization: organization || undefined,
    doctor: doctor || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['booked-tests', filters, page],
    queryFn: () => billingApi.getBookedTests({ ...filters, page, limit: 20 }),
    placeholderData: (prev: any) => prev,
  });

  // The same filters, read as "how many of each test on each day".
  const [view, setView] = useState<'list' | 'count'>('list');
  const { data: countData, isLoading: countLoading } = useQuery({
    queryKey: ['booked-tests-daycount', filters],
    queryFn: () => billingApi.getBookedTests({ ...filters, view: 'daycount', page: 1, limit: 1 }),
    enabled: view === 'count',
    placeholderData: (prev: any) => prev,
  });
  const dayCounts: DayCount[] = (countData?.meta || countData?.pagination || {}).dayCounts || [];
  const countDays = groupByDay(dayCounts);
  const countTotal = dayCounts.reduce((n, c) => n + c.count, 0);

  const { showToast } = useToast();
  const [busy, setBusy] = useState<'' | 'export' | 'print'>('');
  const [printTarget, setPrintTarget] = usePrintTarget<
    { kind: 'list'; tests: BookedTest[]; truncated: boolean } | { kind: 'count'; counts: DayCount[] }
  >();

  const rows = asList<BookedTest>(data, 'tests');
  const meta = data?.meta || data?.pagination || {};
  const totalPages = meta.totalPages || 1;
  const summary = meta.summary || { tests: 0, billed: 0, cancelled: 0, refunded: 0 };

  const applyRange = (next: { from: string; to: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  };

  const activePreset = DATE_PRESETS.find((preset) => {
    const range = preset.range();
    return range.from === from && range.to === to;
  })?.label;

  const rangeLabel = (() => {
    if (!from && !to) return 'All time';
    if (from && from === to) return relativeDayLabel(from);
    if (from && to) return `${formatDay(`${from}T00:00:00`)} - ${formatDay(`${to}T00:00:00`)}`;
    if (from) return `From ${formatDay(`${from}T00:00:00`)}`;
    return `Up to ${formatDay(`${to}T00:00:00`)}`;
  })();

  const anyFilter = !!(search || from || to || status || department || processingMode || paymentStatus || paymentMethod || organization || doctor);

  /** The filters as words, for the top of the printed list. */
  const filterLines = (() => {
    const lines = [`Period: ${rangeLabel}`];
    if (search) lines.push(`Search: "${search}"`);
    if (status) lines.push(`Status: ${STATUS_FILTERS.find((o) => o.value === status)?.label}`);
    if (department) lines.push(`Department: ${departments.find((d: any) => d._id === department)?.departmentName || ''}`);
    if (processingMode) lines.push(`Work: ${processingMode}`);
    if (paymentStatus) lines.push(`Payment: ${paymentStatus === 'Paid' ? 'Paid' : 'Unpaid / due'}`);
    if (paymentMethod) lines.push(`Method: ${methodLabel(paymentMethod)}`);
    if (organization)
      lines.push(`Organization: ${organizations.find((o: any) => o._id === organization)?.organizationName || ''}`);
    if (doctor) lines.push(`Doctor: ${doctors.find((d: any) => d._id === doctor)?.doctorName || ''}`);
    return lines;
  })();

  const loadAll = async () => {
    const result = await billingApi.getBookedTestsForExport(filters);
    if (!result.tests.length) showToast('No tests match this filter', 'error');
    return result;
  };

  const handleExport = async () => {
    setBusy('export');
    try {
      const { tests, truncated } = await loadAll();
      if (!tests.length) return;
      // One row per patient per test: a patient who had the CBC done twice
      // reads as CBC x 2 units, with both bills' amounts added together.
      const groups = new Map<string, BookedTest[]>();
      (tests as BookedTest[]).forEach((t) => {
        const key = `${t.uhid}|${t.testCode || t.testName}`;
        groups.set(key, [...(groups.get(key) || []), t]);
      });
      const joined = (values: (string | undefined)[]) =>
        Array.from(new Set(values.filter(Boolean) as string[])).join(', ');
      const sum = (lines: BookedTest[], pick: (t: BookedTest) => number) =>
        lines.reduce((total, t) => total + (Number(pick(t)) || 0), 0);

      const exportRows = Array.from(groups.values()).map((lines) => {
        const first = lines[0];
        const live = lines.filter((t) => !t.cancelled);
        // The bill's due is per invoice, so count each invoice once.
        const perInvoice = Array.from(new Map(lines.map((t) => [t.invoiceId, t])).values());
        return {
          // Listed booking by booking, not de-duplicated, so the nth date and
          // the nth time belong to the same visit.
          'Bill Date': lines.map((t) => formatDay(t.billedAt)).join(', '),
          'Bill Time': lines.map((t) => formatTime(t.billedAt)).join(', '),
          'Invoice No': joined(lines.map((t) => t.invoiceNumber)),
          UHID: first.uhid,
          'Patient Name': first.patient?.patientName || '',
          Mobile: first.patient?.mobile || '',
          'Referred By': joined(lines.map((t) => t.doctorName || 'Self')),
          'Organization / TPA': joined(lines.map((t) => t.organizationName)),
          'Test Code': first.testCode,
          'Test Name': first.testName,
          Department: first.departmentName,
          Package: joined(lines.map((t) => t.packageName)),
          Processing: joined(lines.map((t) => t.processingMode)),
          'Sample ID': joined(lines.map((t) => t.sampleId)),
          Status: joined(lines.map((t) => statusBadge(t).label)),
          // Cancelled bookings are not work done, so they do not count as units.
          Units: live.length,
          Rate: Number((live[0] || first).rate) || 0,
          'Net Amount': sum(lines, (t) => t.netAmount),
          Refunded: sum(lines, (t) => t.refundedAmount),
          'Bill Payment': joined(perInvoice.map((t) => t.paymentStatus)),
          'Bill Due': sum(perInvoice, (t) => t.dueAmount),
          'Cancellation Reason': joined(lines.map((t) => t.cancellationReason)),
        };
      });
      const windowSlug = !from && !to ? 'all-time' : `${from || 'start'}_to_${to || todayKey()}`;
      await exportToExcel(`booked-tests_${windowSlug}`, exportRows, { sheetName: 'Booked Tests' });
      showToast(
        truncated
          ? `Exported the newest ${tests.length} tests - narrow the dates to export the rest`
          : `Exported ${tests.length} test${tests.length === 1 ? '' : 's'} as ${exportRows.length} row${exportRows.length === 1 ? '' : 's'}`,
        truncated ? 'info' : 'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not export the tests', 'error');
    } finally {
      setBusy('');
    }
  };

  const handlePrintList = async () => {
    if (view === 'count') {
      if (!dayCounts.length) {
        showToast('No tests match this filter', 'error');
        return;
      }
      setPrintTarget({ kind: 'count', counts: dayCounts });
      return;
    }
    setBusy('print');
    try {
      const { tests, truncated } = await loadAll();
      if (tests.length) setPrintTarget({ kind: 'list', tests, truncated });
    } catch (err: any) {
      showToast(err?.message || 'Could not load the tests to print', 'error');
    } finally {
      setBusy('');
    }
  };

  const clearAll = () => {
    setSearchTerm('');
    setSearch('');
    setFrom('');
    setTo('');
    setStatus('');
    setDepartment('');
    setProcessingMode('');
    setPaymentStatus('');
    setPaymentMethod('');
    setOrganization('');
    setDoctor('');
    setPage(1);
  };

  return (
    <>
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <FlaskConical className="h-6 w-6 text-blue-600" />
            <span>Booked Tests</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Every test booked on a bill, with where its sample has got to. Cancel and refund a test from its row.
          </p>
        </div>
        {/* Both work on every test the filters match, not just this page. */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!!busy || !summary.tests}
            isLoading={busy === 'export'}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Export {summary.tests ? `(${summary.tests})` : ''}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintList}
            disabled={!!busy || !summary.tests}
            isLoading={busy === 'print'}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>{view === 'count' ? 'Print Count' : 'Print'}</span>
          </Button>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search test, invoice #, UHID, patient, mobile, doctor..."
                className="pl-9 text-xs"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Test status"
                className={selectClass(!!status)}
              >
                {STATUS_FILTERS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setPage(1);
                }}
                aria-label="Department"
                className={selectClass(!!department)}
              >
                <option value="">All departments</option>
                {departments.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.departmentName || d.name}
                  </option>
                ))}
              </select>

              <select
                value={processingMode}
                onChange={(e) => {
                  setProcessingMode(e.target.value);
                  setPage(1);
                }}
                aria-label="In-house or outsourced"
                className={selectClass(!!processingMode)}
              >
                {PROCESSING_FILTERS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Paid or unpaid"
                className={selectClass(!!paymentStatus)}
              >
                {PAYMENT_FILTERS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                aria-label="Payment method"
                className={selectClass(!!paymentMethod)}
              >
                <option value="">All methods</option>
                {COLLECTION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={organization}
                onChange={(e) => {
                  setOrganization(e.target.value);
                  setPage(1);
                }}
                aria-label="Organization / TPA"
                className={`${selectClass(!!organization)} max-w-[12rem]`}
              >
                <option value="">All organizations / TPA</option>
                {organizations.map((o: any) => (
                  <option key={o._id} value={o._id}>
                    {o.organizationName}
                  </option>
                ))}
              </select>

              <select
                value={doctor}
                onChange={(e) => {
                  setDoctor(e.target.value);
                  setPage(1);
                }}
                aria-label="Referring doctor"
                className={`${selectClass(!!doctor)} max-w-[12rem]`}
              >
                <option value="">All doctors</option>
                {doctors.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.doctorName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              type="date"
              value={from}
              max={to || todayKey()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[9.5rem] text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[9.5rem] text-xs"
            />
            {anyFilter && (
              <Button variant="outline" size="sm" className="h-9 gap-1" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((preset) => {
            const isActive = activePreset === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyRange(preset.range())}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => applyRange({ from: '', to: '' })}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
              !from && !to
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            All time
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tests · {rangeLabel}</p>
            <p className="text-sm font-bold text-foreground">{summary.tests}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Billed (live tests)</p>
            <p className="text-sm font-bold text-foreground">{money(summary.billed)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cancelled</p>
            <p className="text-sm font-bold text-red-600">{summary.cancelled}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Refunded</p>
            <p className="text-sm font-bold text-amber-600">{money(summary.refunded)}</p>
          </div>
        </div>
      </Card>

      <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs font-semibold">
        {(
          [
            ['list', 'Test list'],
            ['count', 'Day-wise count'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'count' && (
        <Card className="overflow-hidden border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3 text-xs">
            <span className="font-semibold text-foreground">
              {rangeLabel} · {countTotal} test{countTotal === 1 ? '' : 's'}
              {countDays.length > 1 ? ` over ${countDays.length} days` : ''}
            </span>
            <span className="text-muted-foreground">
              {status === 'Cancelled' ? 'Cancelled tests only' : 'Cancelled tests are not counted'}
            </span>
          </div>
          {countLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Counting tests...</div>
          ) : countDays.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No tests match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Test</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Department</th>
                    <th className="p-3 text-right">Count</th>
                  </tr>
                </thead>
                {countDays.map((d) => (
                  <tbody key={d.day} className="divide-y divide-border border-b">
                    <tr className="bg-blue-50/60">
                      <td colSpan={3} className="p-3 font-bold text-blue-700">
                        <CalendarDays className="mr-1.5 inline h-4 w-4 align-[-3px]" />
                        {dayHeading(d.day)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700">{d.total}</td>
                    </tr>
                    {d.tests.map((t) => (
                      <tr key={t.testName} className="hover:bg-muted/30">
                        <td className="p-3 pl-9 font-semibold text-foreground">{t.testName}</td>
                        <td className="p-3 font-mono text-muted-foreground">{t.testCode || '—'}</td>
                        <td className="p-3 text-muted-foreground">{t.departmentName || '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className={`overflow-hidden border ${view === 'count' ? 'hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Test</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Doctor / TPA</th>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Sample</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Loading booked tests...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    {anyFilter ? 'No tests match this filter.' : 'No tests booked yet.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const billed = new Date(row.billedAt);
                  const badge = statusBadge(row);
                  return (
                    <tr
                      key={`${row.invoiceId}-${row.itemIndex}`}
                      className={`transition-colors hover:bg-muted/30 ${row.cancelled ? 'opacity-60' : ''}`}
                    >
                      <td className="whitespace-nowrap p-3">
                        <div className="font-semibold text-foreground">{formatDay(billed)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {billed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className={`font-bold text-foreground ${row.cancelled ? 'line-through' : ''}`}>
                          {row.testName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.testCode} · {row.departmentName}
                          {row.packageName ? ` · ${row.packageName}` : ''}
                          {row.processingMode === 'Outsource' ? ' · Outsource' : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{row.patient?.patientName || 'N/A'}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          UHID: {row.uhid}
                          {row.patient?.mobile ? ` · ${row.patient.mobile}` : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-foreground">{row.doctorName || 'Self'}</div>
                        <div className="text-[11px] text-muted-foreground">{row.organizationName || '—'}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-blue-600">{row.invoiceNumber}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.dueAmount > 0 ? `Due ${money(row.dueAmount)}` : 'Paid'}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">{row.sampleId || '—'}</td>
                      <td className="p-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {row.cancelled && row.cancellationReason && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{row.cancellationReason}</div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-foreground">{money(row.netAmount)}</div>
                        {row.refundedAmount > 0 && (
                          <div className="text-[11px] text-red-600">- {money(row.refundedAmount)} refunded</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/billing/${row.invoiceId}`)}>
                            <Eye className="mr-1 h-4 w-4" /> Bill
                          </Button>
                          {/* Always rendered, so the row's buttons line up down the column. */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-300 text-green-700 hover:bg-green-50"
                            disabled={row.cancelled || !toWhatsAppNumber(row.patient?.mobile)}
                            title={
                              row.cancelled
                                ? 'This test was cancelled'
                                : !toWhatsAppNumber(row.patient?.mobile)
                                ? 'No valid mobile number on record'
                                : row.reportResultId
                                ? 'WhatsApp the patient: report ready' + (row.dueAmount > 0 ? ' + due amount' : '')
                                : 'WhatsApp the patient: tests in progress' + (row.dueAmount > 0 ? ' + due amount' : '')
                            }
                            onClick={() =>
                              openWhatsApp(
                                row.patient?.mobile,
                                buildPatientMessage({
                                  patientName: row.patient?.patientName,
                                  invoiceNumber: row.invoiceNumber,
                                  reportReady: !!row.reportResultId,
                                  dueAmount: row.dueAmount,
                                })
                              )
                            }
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </Button>
                          {canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-amber-300 text-amber-700 hover:bg-amber-50"
                              disabled={row.cancelled}
                              title={row.cancelled ? 'Already cancelled' : undefined}
                              onClick={() =>
                                setCancelPreset({
                                  invoiceId: row.invoiceId,
                                  label: `${row.invoiceNumber} - ${row.patient?.patientName || 'N/A'}`,
                                  itemIndex: row.itemIndex,
                                })
                              }
                            >
                              <Undo2 className="mr-1 h-4 w-4" /> Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4 text-xs">
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
      </Card>

      {canCancel && (
        <CancelTestRefundModal
          isOpen={!!cancelPreset}
          onClose={() => setCancelPreset(null)}
          invoices={[]}
          preset={cancelPreset}
          canOverride={hasPermission(user, PERMISSIONS.REFUND_POLICY_MANAGE)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['booked-tests'] });
            queryClient.invalidateQueries({ queryKey: ['refunds-list'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}
    </div>

      {printTarget?.kind === 'count' && (
        <div className="hidden print:block">
          <ListPrintSheet
            title="Day-wise Test Count"
            filterLines={[
              ...filterLines,
              status === 'Cancelled' ? 'Cancelled tests only' : 'Cancelled tests not counted',
            ]}
            countLabel={`${printTarget.counts.reduce((n, c) => n + c.count, 0)} tests`}
            columns={[
              { header: 'Date', nowrap: true },
              { header: 'Test' },
              { header: 'Code', nowrap: true },
              { header: 'Department' },
              { header: 'Count', numeric: true },
            ]}
            rows={groupByDay(printTarget.counts).flatMap((d) =>
              d.tests.map((t, i) => [
                // The day and its total head the day's first line only.
                i === 0 ? <b key="d">{`${formatDay(`${d.day}T00:00:00`)} (${d.total})`}</b> : '',
                t.testName,
                t.testCode || '',
                t.departmentName || '',
                String(t.count),
              ])
            )}
            totals={[
              ['Days', String(groupByDay(printTarget.counts).length)],
              ['Total tests', String(printTarget.counts.reduce((n, c) => n + c.count, 0))],
            ]}
          />
        </div>
      )}

      {printTarget?.kind === 'list' && (
        <div className="hidden print:block">
          <ListPrintSheet
            title="Booked Tests"
            filterLines={filterLines}
            countLabel={`${printTarget.tests.length} test${printTarget.tests.length === 1 ? '' : 's'}`}
            columns={[
              { header: 'Date', nowrap: true },
              { header: 'Patient', nowrap: true },
              { header: 'UHID', nowrap: true },
              { header: 'Test' },
              { header: 'Doctor / TPA' },
              { header: 'Invoice', nowrap: true },
              { header: 'Status' },
              { header: 'Amount (₹)', numeric: true },
            ]}
            rows={printTarget.tests.map((t) => [
              formatDay(t.billedAt),
              t.patient?.patientName || 'N/A',
              t.uhid,
              `${t.testName} (${t.testCode})`,
              [t.doctorName || 'Self', t.organizationName].filter(Boolean).join(' / '),
              t.invoiceNumber,
              statusBadge(t).label,
              (Number(t.netAmount) || 0).toFixed(2),
            ])}
            totals={[
              ['Tests', String(printTarget.tests.length)],
              [
                'Billed (live tests)',
                `₹${printTarget.tests
                  .filter((t) => !t.cancelled)
                  .reduce((s, t) => s + (Number(t.netAmount) || 0), 0)
                  .toFixed(2)}`,
              ],
              ['Cancelled', String(printTarget.tests.filter((t) => t.cancelled).length)],
              [
                'Refunded',
                `₹${printTarget.tests.reduce((s, t) => s + (Number(t.refundedAmount) || 0), 0).toFixed(2)}`,
              ],
            ]}
            note={printTarget.truncated ? 'Only the newest tests are printed - narrow the dates to print the rest.' : undefined}
          />
        </div>
      )}
    </>
  );
};
