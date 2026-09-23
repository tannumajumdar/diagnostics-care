import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { methodLabel, methodColor } from '../../config/payment-methods';
import { formatDay, formatDateTime } from '../../utils/dates';
import { ageLabel } from '../../utils/age';
import {
  ArrowLeft,
  History,
  Receipt,
  FlaskConical,
  IndianRupee,
  FileCheck,
  CalendarDays,
  Wallet,
  ChevronDown,
  Phone,
  Inbox,
} from 'lucide-react';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** A sample's progress, said the way the desk says it to the patient. */
const SAMPLE_TONE: Record<string, string> = {
  Registered: 'bg-slate-100 text-slate-600',
  Collected: 'bg-blue-50 text-blue-700',
  Received: 'bg-blue-50 text-blue-700',
  Processing: 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-rose-50 text-rose-700',
};

const Tile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  rail: string;
  chip: string;
}> = ({ label, value, hint, icon: Icon, rail, chip }) => (
  <div className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <span className={`absolute inset-y-0 left-0 w-[3px] ${rail} opacity-70`} />
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chip}`}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[24px] font-semibold leading-tight tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
    </div>
  </div>
);

/**
 * One patient's whole record at the centre.
 *
 * The profile screen lists bills beside samples and leaves the desk to match
 * them up by date. This is organised by visit instead, because that is the
 * unit the questions come in: what did they come for last time, is that report
 * ready to hand over, and does anything remain unpaid on it.
 */
export const PatientHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [openVisit, setOpenVisit] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => patientApi.getHistory(id!),
    enabled: !!id,
  });

  // The most recent visit is the one being asked about, so it starts open.
  React.useEffect(() => {
    if (data?.visits?.length && openVisit === null) setOpenVisit(data.visits[0].invoiceNumber);
  }, [data, openVisit]);

  if (isLoading) return <div className="p-8 text-center text-xs text-slate-500">Loading patient history...</div>;
  if (!data?.patient) return <div className="p-8 text-center text-xs text-slate-500">Patient not found.</div>;

  const { patient, summary, visits = [], payments = [], appointments = [] } = data;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl"
        />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-300" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-200">
                  Patient history
                </span>
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{patient.patientName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                <span className="font-mono">{patient.uhid}</span>
                <span>
                  {ageLabel(patient)} · {patient.gender}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {patient.mobile}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="h-9 gap-1.5 bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              {/* Checking the history is how the desk confirms a returning
                  patient, so the next bill starts from here. */}
              <Button
                onClick={() => navigate(`/billing/new?patientId=${patient._id ?? id}`)}
                className="h-9 gap-1.5"
              >
                <Receipt className="h-3.5 w-3.5" /> New bill
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate(`/patients/${patient._id ?? id}`)}
                className="h-9 gap-1.5 bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/20 hover:text-white"
              >
                Profile
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <span className="text-[48px] font-semibold leading-none tracking-tight sm:text-5xl">
              {summary.visits}
            </span>
            <p className="mt-2 text-xs font-medium text-slate-300">
              visit{summary.visits === 1 ? '' : 's'} at this centre
            </p>
            <p className="text-[12px] text-slate-500">
              {summary.firstVisit
                ? `First came ${formatDay(summary.firstVisit)} · last ${formatDay(summary.lastVisit)}`
                : 'No bills raised yet'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Tests done"
          value={String(summary.tests)}
          hint={`${summary.reportsReady} report${summary.reportsReady === 1 ? '' : 's'} released`}
          icon={FlaskConical}
          rail="bg-blue-500"
          chip="bg-blue-50 text-blue-600"
        />
        <Tile
          label="Total billed"
          value={money(summary.totalBilled)}
          icon={Receipt}
          rail="bg-violet-500"
          chip="bg-violet-50 text-violet-600"
        />
        <Tile
          label="Paid"
          value={money(summary.totalPaid)}
          hint={`${payments.length} receipt${payments.length === 1 ? '' : 's'}`}
          icon={Wallet}
          rail="bg-emerald-500"
          chip="bg-emerald-50 text-emerald-600"
        />
        <Tile
          label="Outstanding"
          value={money(summary.outstanding)}
          hint={summary.outstanding > 0 ? 'to collect' : 'nothing due'}
          icon={IndianRupee}
          rail={summary.outstanding > 0 ? 'bg-rose-500' : 'bg-slate-300'}
          chip={summary.outstanding > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}
        />
      </div>

      {/* Visits, newest first. Each one opens to the tests it covered. */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Visits</h2>
          <p className="text-[12px] text-slate-500">Each bill with the tests it covered and where they got to.</p>
        </header>

        {visits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Inbox className="h-7 w-7 text-slate-300" />
            <p className="text-xs text-slate-400">This patient has not been billed yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visits.map((visit: any) => {
              const open = openVisit === visit.invoiceNumber;
              return (
                <li key={visit.invoiceNumber}>
                  <button
                    type="button"
                    onClick={() => setOpenVisit(open ? '' : visit.invoiceNumber)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50/60"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${open ? '' : '-rotate-90'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{formatDay(visit.date)}</span>
                        <span className="font-mono text-[11px] text-slate-400">{visit.invoiceNumber}</span>
                        {visit.doctorName && (
                          <span className="text-[11px] text-slate-400">Ref: {visit.doctorName}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {visit.testCount} test{visit.testCount === 1 ? '' : 's'}
                        {visit.reportsReady > 0 && (
                          <span className="font-medium text-emerald-700"> · {visit.reportsReady} report ready</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums text-slate-900">{money(visit.netAmount)}</p>
                      {visit.dueAmount > 0 ? (
                        <p className="text-[11px] font-semibold text-rose-600">Due {money(visit.dueAmount)}</p>
                      ) : (
                        <Badge variant="success">Paid</Badge>
                      )}
                    </div>
                  </button>

                  {open && (
                    <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Tests
                        </p>
                        {visit.tests.length === 0 ? (
                          <p className="text-[12px] text-slate-400">No samples were registered against this bill.</p>
                        ) : (
                          <ul className="space-y-1">
                            {visit.tests.map((test: any) => (
                              <li
                                key={test.sampleId}
                                className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs"
                              >
                                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                                  {test.testName}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">{test.sampleId}</span>
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                                    SAMPLE_TONE[test.sampleStatus] || 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {test.sampleStatus}
                                </span>
                                {test.reportReady && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    <FileCheck className="h-2.5 w-2.5" />
                                    Report ready
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {visit.payments.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Paid on this bill
                          </p>
                          <ul className="space-y-1">
                            {visit.payments.map((payment: any) => (
                              <li
                                key={payment.receiptNumber}
                                className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs"
                              >
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: methodColor(payment.paymentMethod) }}
                                />
                                <span className="text-slate-600">{methodLabel(payment.paymentMethod)}</span>
                                <span className="font-mono text-[11px] text-slate-400">{payment.receiptNumber}</span>
                                <span className="ml-auto font-semibold tabular-nums text-slate-900">
                                  {money(payment.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/billing/${visit.invoiceId}`)}>
                          Open bill
                        </Button>
                        {visit.dueAmount > 0 && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/billing/${visit.invoiceId}`)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Collect {money(visit.dueAmount)}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">All receipts</h2>
          </header>
          {payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">Nothing collected yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((payment: any) => (
                <li key={payment.receiptNumber} className="flex items-center gap-2.5 px-5 py-2.5 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: methodColor(payment.paymentMethod) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{methodLabel(payment.paymentMethod)}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">
                      {payment.receiptNumber} · {formatDateTime(payment.date)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{money(payment.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Appointments</h2>
          </header>
          {appointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-slate-400">No appointments booked.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {appointments.map((appointment: any) => (
                <li key={appointment.appointmentId} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {formatDay(appointment.date)} · {appointment.time}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {appointment.collectionType} · {appointment.appointmentId}
                    </p>
                  </div>
                  <Badge variant={appointment.status === 'Completed' ? 'success' : 'secondary'}>
                    {appointment.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default PatientHistoryPage;
