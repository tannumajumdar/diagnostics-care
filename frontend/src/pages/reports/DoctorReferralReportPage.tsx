import React, { useState } from 'react';
import { ageLabel } from '../../utils/age';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Printer, Download, CalendarDays } from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import { doctorApi } from '../../api/doctor.api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DateInput } from '../../components/ui/date-input';
import { ListPrintSheet } from '../../components/billing/ListPrintSheet';
import { useToast } from '../../context/ToastContext';
import { usePrintTarget } from '../../hooks/usePrintTarget';
import { asList } from '../../utils/api-list';
import { exportToExcel } from '../../utils/excel-export';
import { DATE_PRESETS, formatDay, relativeDayLabel } from '../../utils/dates';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** One referred visit as the server sends it. */
interface ReferralRow {
  invoiceId: string;
  invoiceNumber: string;
  billedAt: string;
  uhid: string;
  patient: { patientName?: string; age?: number; gender?: string; mobile?: string } | null;
  doctorId: string | null;
  doctorName: string;
  onPanel: boolean;
  /** Per test: the centre's rate, the doctor's-copy rate, and the difference the doctor keeps. */
  tests: Array<{ testName: string; testCode?: string; rate: number; referralRate: number; charges: number }>;
  rate: number;
  referralRate: number;
  charges: number;
}

interface DoctorGroup {
  key: string;
  doctorName: string;
  onPanel: boolean;
  rows: ReferralRow[];
  tests: number;
  rate: number;
  referralRate: number;
  charges: number;
}

/** The visits under their doctor, the doctor earning the most first. */
const groupByDoctor = (rows: ReferralRow[]): DoctorGroup[] => {
  const groups = new Map<string, DoctorGroup>();
  for (const row of rows) {
    const key = row.doctorId || `name:${row.doctorName.trim().toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, doctorName: row.doctorName, onPanel: row.onPanel, rows: [], tests: 0, rate: 0, referralRate: 0, charges: 0 };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.tests += row.tests.length;
    group.rate += row.rate;
    group.referralRate += row.referralRate;
    group.charges += row.charges;
  }
  return Array.from(groups.values()).sort((a, b) => b.charges - a.charges || b.referralRate - a.referralRate);
};

const patientLine = (row: ReferralRow) =>
  [row.patient?.patientName || 'N/A', [row.patient && ageLabel(row.patient) !== '-' && ageLabel(row.patient), row.patient?.gender].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' · ');

const testsLine = (row: ReferralRow) => row.tests.map((t) => t.testName).join(', ');

export const DoctorReferralReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const thisMonth = DATE_PRESETS.find((p) => p.label === 'This month')!.range();
  const [from, setFrom] = useState(thisMonth.from);
  const [to, setTo] = useState(thisMonth.to);
  const [doctor, setDoctor] = useState('');
  const [busy, setBusy] = useState(false);
  const [printTarget, setPrintTarget] = usePrintTarget<DoctorGroup[]>();

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-filter'],
    queryFn: () => doctorApi.getAll({ limit: 500 }),
  });
  const doctors = asList<any>(doctorsData, 'doctors');

  const { data, isLoading } = useQuery({
    queryKey: ['doctor-referrals', from, to, doctor],
    queryFn: () =>
      reportsApi.getDoctorReferrals({ from: from || undefined, to: to || undefined, doctor: doctor || undefined }),
    placeholderData: (prev: any) => prev,
  });
  const rows = asList<ReferralRow>(data);
  const groups = groupByDoctor(rows);

  const total = {
    visits: rows.length,
    tests: groups.reduce((n, g) => n + g.tests, 0),
    rate: groups.reduce((n, g) => n + g.rate, 0),
    referralRate: groups.reduce((n, g) => n + g.referralRate, 0),
    charges: groups.reduce((n, g) => n + g.charges, 0),
  };

  const rangeLabel = (() => {
    if (!from && !to) return 'All time';
    if (from && from === to) return relativeDayLabel(from);
    if (from && to) return `${formatDay(`${from}T00:00:00`)} - ${formatDay(`${to}T00:00:00`)}`;
    if (from) return `From ${formatDay(`${from}T00:00:00`)}`;
    return `Up to ${formatDay(`${to}T00:00:00`)}`;
  })();

  const filterLines = [
    `Period: ${rangeLabel}`,
    doctor ? `Doctor: ${doctors.find((d: any) => d._id === doctor)?.doctorName || ''}` : 'Doctor: All referring doctors',
    'Referral charges = Referral rate - Lab rate',
  ];

  const activePreset = DATE_PRESETS.find((preset) => {
    const range = preset.range();
    return range.from === from && range.to === to;
  })?.label;

  const handleExport = async () => {
    if (!rows.length) return;
    setBusy(true);
    try {
      // One row per test, so the sheet can be pivoted by doctor, day or test.
      const exportRows = groups.flatMap((g) =>
        g.rows.flatMap((r) =>
          r.tests.map((t) => ({
            Doctor: g.doctorName,
            Date: formatDay(r.billedAt),
            Patient: r.patient?.patientName || '',
            Age: r.patient?.age ?? '',
            Gender: r.patient?.gender || '',
            UHID: r.uhid,
            'Bill No': r.invoiceNumber,
            Test: t.testName,
            'Test Code': t.testCode || '',
            'Lab Rate': t.rate,
            'Referral Rate': t.referralRate,
            'Referral Charges': t.charges,
          }))
        )
      );
      await exportToExcel(`doctor-referrals_${from || 'start'}_to_${to || 'today'}`, exportRows, {
        sheetName: 'Doctor Referrals',
      });
    } catch (err: any) {
      showToast(err?.message || 'Could not export the report', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="space-y-4 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl [&>svg]:shrink-0">
              <Stethoscope className="h-6 w-6 text-blue-600" />
              <span>Doctor Referral Report</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Which patients each doctor referred, on which day, for which tests. Referral charges are each test's
              referral rate less the lab's own rate.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={busy || !rows.length} isLoading={busy} className="gap-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
            <Button variant="outline" onClick={() => setPrintTarget(groups)} disabled={!rows.length} className="gap-2">
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </Button>
          </div>
        </div>

        <Card className="space-y-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs lg:w-64"
            >
              <option value="">All referring doctors</option>
              {doctors.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d.doctorName}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>From</span>
              <DateInput className="w-36" value={from} max={to || undefined} onChange={setFrom} />
              <span>To</span>
              <DateInput className="w-36" value={to} min={from || undefined} onChange={setTo} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const range = preset.range();
                  setFrom(range.from);
                  setTo(range.to);
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                  activePreset === preset.label
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                !from && !to ? 'border-blue-600 bg-blue-600 text-white' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              All time
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Patients / visits</p>
              <p className="text-sm font-bold text-foreground">{total.visits}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tests</p>
              <p className="text-sm font-bold text-foreground">{total.tests}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lab rate</p>
              <p className="text-sm font-bold text-foreground">{money(total.rate)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral rate</p>
              <p className="text-sm font-bold text-foreground">{money(total.referralRate)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral charges</p>
              <p className="text-sm font-bold text-green-700">{money(total.charges)}</p>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="p-8 text-center text-xs text-muted-foreground">Loading referrals...</Card>
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground">No referred patients in this period.</Card>
        ) : (
          groups.map((g) => (
            <Card key={g.key} className="overflow-hidden border">
              <div className="flex flex-col gap-2 border-b bg-muted/40 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    {g.doctorName}
                    {!g.onPanel && <Badge variant="amber">Not on panel</Badge>}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {g.rows.length} patient{g.rows.length === 1 ? '' : 's'} · {g.tests} test{g.tests === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex gap-6 text-right font-mono">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lab rate</p>
                    <p className="font-bold text-foreground">{money(g.rate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral rate</p>
                    <p className="font-bold text-foreground">{money(g.referralRate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral charges</p>
                    <p className="font-bold text-green-700">{money(g.charges)}</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Bill #</th>
                      <th className="p-3">Test</th>
                      <th className="p-3 text-right">Lab rate</th>
                      <th className="p-3 text-right">Referral rate</th>
                      <th className="p-3 text-right">Referral charges</th>
                    </tr>
                  </thead>
                  {g.rows.map((r) => (
                    <tbody key={r.invoiceId} className="border-b">
                      {r.tests.map((t, i) => (
                        <tr key={`${t.testName}-${i}`} className="align-top hover:bg-muted/30">
                          {/* The visit's own details head its first test only. */}
                          {i === 0 && (
                            <>
                              <td rowSpan={r.tests.length} className="whitespace-nowrap p-3">
                                <CalendarDays className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" />
                                {formatDay(r.billedAt)}
                              </td>
                              <td rowSpan={r.tests.length} className="p-3">
                                <div className="font-semibold text-foreground">{patientLine(r)}</div>
                                <div className="font-mono text-[11px] text-muted-foreground">UHID: {r.uhid}</div>
                              </td>
                              <td rowSpan={r.tests.length} className="p-3 font-mono">
                                <button
                                  type="button"
                                  className="font-bold text-blue-600 hover:underline"
                                  onClick={() => navigate(`/billing/${r.invoiceId}`)}
                                >
                                  {r.invoiceNumber}
                                </button>
                              </td>
                            </>
                          )}
                          <td className="p-3 text-foreground">{t.testName}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">{money(t.rate)}</td>
                          <td className="p-3 text-right font-mono text-foreground">{money(t.referralRate)}</td>
                          <td className="p-3 text-right font-mono font-bold text-green-700">{money(t.charges)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </Card>
          ))
        )}
      </div>

      {printTarget && (
        <div className="hidden print:block">
          <ListPrintSheet
            title="Doctor Referral Report"
            filterLines={filterLines}
            countLabel={`${printTarget.reduce((n, g) => n + g.rows.length, 0)} patients`}
            columns={[
              { header: 'Doctor' },
              { header: 'Date', nowrap: true },
              { header: 'Patient' },
              { header: 'Bill No', nowrap: true },
              { header: 'Tests' },
              { header: 'Lab Rate (₹)', numeric: true },
              { header: 'Ref. Rate (₹)', numeric: true },
              { header: 'Charges (₹)', numeric: true },
            ]}
            rows={printTarget.flatMap((g) =>
              g.rows.map((r, i) => [
                // The doctor and their totals head their first visit only.
                i === 0 ? (
                  <b key="d">{`${g.doctorName} (${g.rows.length} pts, ₹${g.charges.toLocaleString('en-IN')})`}</b>
                ) : (
                  ''
                ),
                formatDay(r.billedAt),
                `${patientLine(r)} (${r.uhid})`,
                r.invoiceNumber,
                testsLine(r),
                r.rate.toFixed(2),
                r.referralRate.toFixed(2),
                r.charges.toFixed(2),
              ])
            )}
            totals={[
              ...printTarget.map((g) => [g.doctorName, `₹${g.charges.toFixed(2)}`] as [string, string]),
              ['Total lab rate', `₹${printTarget.reduce((n, g) => n + g.rate, 0).toFixed(2)}`],
              ['Total referral rate', `₹${printTarget.reduce((n, g) => n + g.referralRate, 0).toFixed(2)}`],
              ['Total referral charges', `₹${printTarget.reduce((n, g) => n + g.charges, 0).toFixed(2)}`],
            ]}
          />
        </div>
      )}
    </>
  );
};
