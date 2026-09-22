import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/reports.api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from 'recharts';
import {
  SERIES,
  INK,
  inr,
  compactInr,
  compactCount,
  axisProps,
  gridProps,
  ChartTooltip,
  foldTail,
} from '../../config/charts';
import { methodColor, methodLabel } from '../../config/payment-methods';
import { formatDay } from '../../utils/dates';
import {
  BarChart3,
  TrendingUp,
  Building,
  Activity,
  Users,
  Wallet,
  Receipt,
  IndianRupee,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';

/**
 * A chart card. Every panel on this page wears the same frame - title, one
 * line of context, an optional legend - so six different aggregations read as
 * one report rather than six widgets that happened to land on a page.
 */
const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClass?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
  /** Tall enough for the plot and the axis band beneath it. */
  height?: string;
}> = ({ title, subtitle, icon: Icon, iconClass = 'text-blue-600 bg-blue-50', legend, children, height = 'h-72' }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {legend && <div className="flex flex-wrap items-center gap-3">{legend}</div>}
    </header>
    <div className={`${height} w-full px-2 pb-2 pt-4`}>{children}</div>
  </section>
);

const Key: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

const Kpi: React.FC<{ label: string; value: string; hint?: string; icon: LucideIcon; rail: string; chip: string }> = ({
  label,
  value,
  hint,
  icon: Icon,
  rail,
  chip,
}) => (
  <div className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <span className={`absolute inset-y-0 left-0 w-[3px] ${rail} opacity-70`} />
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chip}`}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-slate-400">{hint}</p>}
    </div>
  </div>
);

/** An empty panel says so, rather than leaving an axis floating on its own. */
const NoData: React.FC<{ message?: string }> = ({ message = 'Nothing to chart yet.' }) => (
  <div className="flex h-full items-center justify-center text-xs text-slate-400">{message}</div>
);

export const ReportsPage: React.FC = () => {
  const { data: dailyRev = [] } = useQuery({
    queryKey: ['report-daily-rev'],
    queryFn: () => reportsApi.getDailyRevenue(),
  });

  const { data: monthlyRev = [] } = useQuery({
    queryKey: ['report-monthly-rev'],
    queryFn: () => reportsApi.getMonthlyRevenue(),
  });

  const { data: testRev = [] } = useQuery({
    queryKey: ['report-test-rev'],
    queryFn: () => reportsApi.getTestWiseRevenue(),
  });

  const { data: deptTests = [] } = useQuery({
    queryKey: ['report-dept-tests'],
    queryFn: () => reportsApi.getDepartmentWiseTests(),
  });

  const { data: docTests = [] } = useQuery({
    queryKey: ['report-doc-tests'],
    queryFn: () => reportsApi.getDoctorWiseTests(),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['report-payment-methods'],
    queryFn: () => reportsApi.getPaymentMethods(),
  });

  /**
   * The daily series is every day the centre has ever billed. Plotted whole it
   * turns into an unreadable comb of tick labels, so the card shows the last
   * 30 days and says so - the monthly panel beside it carries the long view.
   */
  const daily = React.useMemo(
    () =>
      (dailyRev as any[]).slice(-30).map((d) => ({
        ...d,
        tick: formatDay(`${d._id}T00:00:00`).replace(/ \d{4}$/, ''),
        label: formatDay(`${d._id}T00:00:00`),
      })),
    [dailyRev]
  );

  const monthly = React.useMemo(
    () =>
      (monthlyRev as any[]).map((m) => ({
        ...m,
        tick: new Date(`${m._id}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      })),
    [monthlyRev]
  );

  // Top performers only. A bar per test across a full catalogue is a wall, and
  // the tail is answered by the table on the test master, not by this page.
  const topTests = React.useMemo(
    () =>
      (testRev as any[])
        .slice(0, 8)
        .map((t) => ({ name: String(t._id ?? 'Unknown'), value: Number(t.totalRevenue) || 0, count: t.totalCount })),
    [testRev]
  );

  const topDoctors = React.useMemo(
    () =>
      (docTests as any[])
        .slice(0, 8)
        .map((d) => ({ name: String(d._id ?? 'Unknown'), value: Number(d.totalRevenue) || 0, count: d.invoiceCount })),
    [docTests]
  );

  const departments = React.useMemo(() => foldTail(deptTests as any[], 'testCount', '_id', 6), [deptTests]);
  const deptTotal = departments.reduce((s, d) => s + d.value, 0);

  const payments = React.useMemo(() => foldTail(paymentMethods as any[], 'totalAmount', '_id', 6), [paymentMethods]);
  const paymentsTotal = payments.reduce((s, p) => s + p.value, 0);

  // Headline figures, summed off the same aggregations the charts are drawn
  // from, so the tiles and the plots can never disagree.
  const totalRevenue = (monthlyRev as any[]).reduce((s, m) => s + (Number(m.revenue) || 0), 0);
  const totalCollected = (monthlyRev as any[]).reduce((s, m) => s + (Number(m.collections) || 0), 0);
  const outstanding = Math.max(0, totalRevenue - totalCollected);
  const testsBilled = (testRev as any[]).reduce((s, t) => s + (Number(t.totalCount) || 0), 0);
  const collectionRate = totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Analytics</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Business Performance</h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Revenue, collections, test volumes and referrals, aggregated across every invoice the centre has raised.
          </p>

          {/* The one figure this page leads with. */}
          <div className="mt-5">
            <span className="text-[44px] font-semibold leading-none tracking-tight sm:text-5xl">
              {inr(totalRevenue)}
            </span>
            <p className="mt-2 text-xs font-medium text-slate-300">Total billed, all time</p>
            <p className="text-[11px] text-slate-500">
              {inr(totalCollected)} collected · {collectionRate}% of what was billed
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Collected"
          value={inr(totalCollected)}
          hint={`${collectionRate}% of billed`}
          icon={Wallet}
          rail="bg-emerald-500"
          chip="bg-emerald-50 text-emerald-600"
        />
        <Kpi
          label="Outstanding"
          value={inr(outstanding)}
          hint="still to be recovered"
          icon={IndianRupee}
          rail="bg-rose-500"
          chip="bg-rose-50 text-rose-600"
        />
        <Kpi
          label="Tests billed"
          value={compactCount(testsBilled)}
          hint={`${(testRev as any[]).length} distinct tests`}
          icon={FlaskConical}
          rail="bg-blue-500"
          chip="bg-blue-50 text-blue-600"
        />
        <Kpi
          label="Invoices raised"
          value={compactCount((dailyRev as any[]).reduce((s, d) => s + (Number(d.totalInvoices) || 0), 0))}
          hint={`across ${(dailyRev as any[]).length} billing days`}
          icon={Receipt}
          rail="bg-violet-500"
          chip="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Billed vs collected"
          subtitle={daily.length ? `Last ${daily.length} billing days` : undefined}
          icon={TrendingUp}
          iconClass="bg-emerald-50 text-emerald-600"
          legend={
            <>
              <Key color={SERIES[0]} label="Billed" />
              <Key color={SERIES[2]} label="Collected" />
            </>
          }
        >
          {daily.length === 0 ? (
            <NoData message="No invoices raised yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="billedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="collectedRevFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[2]} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={SERIES[2]} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="tick" {...axisProps} minTickGap={24} dy={4} />
                <YAxis {...axisProps} width={56} tickFormatter={compactInr} />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v: number) => inr(v)}
                      labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.label ?? ''}
                    />
                  }
                  cursor={{ stroke: INK.axis, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="netAmount"
                  name="Billed"
                  stroke={SERIES[0]}
                  strokeWidth={2}
                  fill="url(#billedFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: SERIES[0], stroke: INK.surface, strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="paidAmount"
                  name="Collected"
                  stroke={SERIES[2]}
                  strokeWidth={2}
                  fill="url(#collectedRevFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: SERIES[2], stroke: INK.surface, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Revenue by month"
          subtitle="What was billed against what came in"
          icon={BarChart3}
          iconClass="bg-blue-50 text-blue-600"
          legend={
            <>
              <Key color={SERIES[0]} label="Billed" />
              <Key color={SERIES[2]} label="Collected" />
            </>
          }
        >
          {monthly.length === 0 ? (
            <NoData message="No monthly revenue yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* barGap is the 2px surface gap - white doing the separating,
                  rather than a stroke drawn around each bar. */}
              <BarChart data={monthly} margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="tick" {...axisProps} dy={4} />
                <YAxis {...axisProps} width={56} tickFormatter={compactInr} />
                <Tooltip
                  content={<ChartTooltip formatter={(v: number) => inr(v)} />}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                />
                <Bar dataKey="revenue" name="Billed" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="collections" name="Collected" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top tests by revenue"
          subtitle={topTests.length ? `Highest earning ${topTests.length} of ${(testRev as any[]).length}` : undefined}
          icon={Activity}
          iconClass="bg-violet-50 text-violet-600"
          height="h-80"
        >
          {topTests.length === 0 ? (
            <NoData message="No tests billed yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* One series, so one hue - never a ramp across nominal
                  categories, which would double-encode the bar's own length. */}
              <BarChart data={topTests} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} vertical horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={compactInr} />
                {/* Recharts does not clip a category tick - a long test name
                    just runs off the left edge of the card - so it is cut to
                    what the gutter holds, with the full name in the tooltip. */}
                <YAxis
                  type="category"
                  dataKey="name"
                  {...axisProps}
                  width={132}
                  tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
                />
                <Tooltip
                  content={<ChartTooltip formatter={(v: number) => inr(v)} />}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                />
                <Bar dataKey="value" name="Revenue" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {/* The value rides outside the bar end, so a short bar's
                      label is never cropped by its own mark. */}
                  <LabelList
                    dataKey="value"
                    position="right"
                    offset={8}
                    formatter={(v: any) => compactInr(Number(v))}
                    style={{ fontSize: 10, fill: INK.secondary, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Tests by department"
          subtitle={deptTotal ? `${compactCount(deptTotal)} tests billed` : undefined}
          icon={Building}
          iconClass="bg-amber-50 text-amber-600"
          height="h-80"
        >
          {departments.length === 0 ? (
            <NoData message="No department volume yet." />
          ) : (
            /* Part-to-whole with long category names reads better as one
               horizontal stacked bar than as a pie whose labels collide. */
            <div className="flex h-full flex-col justify-center gap-4 px-3">
              <div className="flex h-7 w-full overflow-hidden rounded-lg">
                {departments.map((dept, i) => (
                  <div
                    key={dept.name}
                    title={`${dept.name}: ${dept.value}`}
                    className="h-full first:rounded-l-lg last:rounded-r-lg"
                    style={{
                      width: `${deptTotal ? (dept.value / deptTotal) * 100 : 0}%`,
                      backgroundColor: SERIES[i % SERIES.length],
                      // The 2px separator is the surface showing through, not
                      // a border drawn around the segment.
                      marginRight: i < departments.length - 1 ? 2 : 0,
                    }}
                  />
                ))}
              </div>

              <ul className="space-y-1.5 overflow-y-auto">
                {departments.map((dept, i) => (
                  <li key={dept.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: SERIES[i % SERIES.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-600">{dept.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {deptTotal ? Math.round((dept.value / deptTotal) * 100) : 0}%
                    </span>
                    <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-slate-900">
                      {dept.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Referral revenue by doctor"
          subtitle={topDoctors.length ? `Top ${topDoctors.length} referrers` : undefined}
          icon={Users}
          iconClass="bg-blue-50 text-blue-600"
          height="h-80"
        >
          {topDoctors.length === 0 ? (
            <NoData message="No referrals recorded yet." />
          ) : (
            /* Horizontal, like the tests panel beside it: doctor names are
               long enough that eight of them along an x-axis either overlap
               or get rotated into something nobody reads. */
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDoctors} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} vertical horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={compactInr} />
                <YAxis
                  type="category"
                  dataKey="name"
                  {...axisProps}
                  width={132}
                  tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
                />
                <Tooltip
                  content={<ChartTooltip formatter={(v: number) => inr(v)} />}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                />
                <Bar dataKey="value" name="Revenue" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    offset={8}
                    formatter={(v: any) => compactInr(Number(v))}
                    style={{ fontSize: 10, fill: INK.secondary, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="How patients paid"
          subtitle={paymentsTotal ? `${inr(paymentsTotal)} received` : undefined}
          icon={Wallet}
          iconClass="bg-emerald-50 text-emerald-600"
        >
          {payments.length === 0 ? (
            <NoData message="No payments recorded yet." />
          ) : (
            <div className="flex h-full items-center gap-4">
              <div className="relative h-full min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payments}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={2}
                      stroke={INK.surface}
                      strokeWidth={2}
                    >
                      {/* Keyed to the method, never to the slice's rank. */}
                      {payments.map((entry) => (
                        <Cell key={entry.name} fill={methodColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatter={(v: number) => inr(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* The total in the hole, so the donut answers "how much"
                    without the reader adding the slices up. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-semibold tracking-tight text-slate-900">
                    {compactInr(paymentsTotal)}
                  </span>
                  <span className="text-[10px] text-slate-400">received</span>
                </div>
              </div>

              <ul className="w-36 shrink-0 space-y-1.5 pr-2">
                {payments.map((method) => (
                  <li key={method.name} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: methodColor(method.name) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{methodLabel(method.name)}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        {paymentsTotal ? Math.round((method.value / paymentsTotal) * 100) : 0}%
                      </span>
                    </div>
                    <p className="ml-3.5 font-semibold tabular-nums text-slate-900">{inr(method.value)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
};
