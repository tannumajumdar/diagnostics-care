import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { sampleApi } from '../api/sample.api';
import { billingApi } from '../api/billing.api';
import { resultApi } from '../api/result.api';
import { patientApi } from '../api/patient.api';
import { accountsApi } from '../api/accounts.api';
import { useAuth } from '../context/AuthContext';
import { asList } from '../utils/api-list';
import { ROLE_INTRO, hasPermission, PERMISSIONS, type Role } from '../config/roles';
import { SERIES, INK, inr, compactInr, axisProps, gridProps } from '../config/charts';
import { relativeDayLabel, weekdayLabel } from '../utils/dates';
import { Button } from '../components/ui/button';
import {
  Users,
  TestTube,
  Receipt,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Plus,
  Syringe,
  Microscope,
  ClipboardCheck,
  FileCheck,
  IndianRupee,
  Wallet,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

type Tone = 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' | 'slate';

/**
 * A tile's tone is decoration on the icon only - the value itself stays in
 * ink, so a column of figures reads as one column rather than as six colours
 * competing for the eye.
 */
const TONES: Record<Tone, { chip: string; icon: string; rail: string }> = {
  blue: { chip: 'bg-blue-50', icon: 'text-blue-600', rail: 'bg-blue-500' },
  amber: { chip: 'bg-amber-50', icon: 'text-amber-600', rail: 'bg-amber-500' },
  emerald: { chip: 'bg-emerald-50', icon: 'text-emerald-600', rail: 'bg-emerald-500' },
  violet: { chip: 'bg-violet-50', icon: 'text-violet-600', rail: 'bg-violet-500' },
  rose: { chip: 'bg-rose-50', icon: 'text-rose-600', rail: 'bg-rose-500' },
  slate: { chip: 'bg-slate-100', icon: 'text-slate-600', rail: 'bg-slate-400' },
};

interface Tile {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  to?: string;
  hint?: string;
}

const StatTile: React.FC<{ tile: Tile; onClick?: () => void }> = ({ tile, onClick }) => {
  const tone = TONES[tile.tone];
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/[0.02] transition-all duration-200 ${
        onClick
          ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60'
          : 'cursor-default'
      }`}
    >
      {/* A 3px rail rather than a tinted card - the colour marks the tile
          without washing the number it sits next to. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${tone.rail} opacity-70`} />

      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
        <Icon className={`h-[18px] w-[18px] ${tone.icon}`} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-slate-500">{tile.label}</span>
        <span className="mt-0.5 block truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
          {tile.value}
        </span>
        {tile.hint && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{tile.hint}</span>}
      </span>

      {onClick && (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
      )}
    </button>
  );
};

const money = (n: number) => inr(n);

/** "Good morning" / "Good afternoon" / "Good evening", by the browser clock. */
const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/** The day's figures behind a point on the collections chart. */
const CollectionsTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  const methods = [
    ['Cash', day.cash],
    ['UPI', day.upi],
    ['Card', day.card],
    ['Bank', day.bank],
  ].filter(([, amount]) => Number(amount) > 0) as [string, number][];

  return (
    <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="font-semibold text-slate-900">{day.label}</p>
      <p className="mb-1.5 text-[10px] text-slate-400">
        {day.count === 0 ? 'No payments' : `${day.count} receipt${day.count === 1 ? '' : 's'}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES[0] }} />
        <span className="text-slate-500">Collected</span>
        <span className="ml-auto font-semibold tabular-nums text-slate-900">{money(day.total)}</span>
      </div>
      {day.paidOut > 0 && (
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES[1] }} />
          <span className="text-slate-500">Paid out</span>
          <span className="ml-auto font-semibold tabular-nums text-slate-900">{money(day.paidOut)}</span>
        </div>
      )}
      {methods.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5">
          {methods.map(([name, amount]) => (
            <div key={name} className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">{name}</span>
              <span className="ml-auto tabular-nums text-slate-600">{money(amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role ?? 'Receptionist') as Role;

  // Each panel is fetched only where the API would actually answer, so no desk
  // fires a query its token is refused on.
  const needsSamples = hasPermission(user, PERMISSIONS.SAMPLE_VIEW);
  const needsBilling = hasPermission(user, PERMISSIONS.BILL_VIEW);
  const needsResults = hasPermission(user, PERMISSIONS.RESULT_VERIFY);
  const needsPayouts = hasPermission(user, PERMISSIONS.PAYOUT_VIEW);

  const { data: stats } = useQuery({
    queryKey: ['sample-stats'],
    queryFn: () => sampleApi.getStats(),
    enabled: needsSamples,
  });

  const { data: invoiceData } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => billingApi.getAllInvoices({ limit: 6 }),
    enabled: needsBilling,
  });

  const { data: pendingResults } = useQuery({
    queryKey: ['dashboard-pending-results'],
    queryFn: () => resultApi.getPending({ limit: 6 }),
    enabled: needsResults,
  });

  const { data: patientData } = useQuery({
    queryKey: ['dashboard-patients'],
    queryFn: () => patientApi.getAll({ limit: 1 }),
    enabled: hasPermission(user, PERMISSIONS.PATIENT_VIEW),
  });

  const { data: collections } = useQuery({
    queryKey: ['dashboard-collections'],
    queryFn: () => accountsApi.getDailyCollections(),
    enabled: needsBilling,
  });

  /**
   * What came in each day this week. The single "collected today" figure never
   * answered the question the desk and the owner actually ask at closing -
   * whether today was a normal day - so the week sits next to it.
   */
  const { data: collectionTrend } = useQuery({
    queryKey: ['dashboard-collection-trend'],
    queryFn: () => accountsApi.getCollectionTrend({ days: 7 }),
    enabled: needsBilling,
  });

  const { data: payoutSummary } = useQuery({
    queryKey: ['dashboard-payouts'],
    queryFn: () => accountsApi.getPayoutSummary(),
    enabled: needsPayouts,
  });

  const invoices = asList<any>(invoiceData, 'invoices');
  const pending = asList<any>(pendingResults, 'results');
  const patientTotal = patientData?.meta?.total ?? asList(patientData, 'patients').length;

  const collected = stats?.collected ?? 0;
  const pendingCollection = stats?.pendingCollection ?? 0;
  const processing = stats?.processing ?? 0;
  const completed = stats?.completed ?? 0;
  const rejected = stats?.rejected ?? 0;

  const trendDays = asList<any>(collectionTrend?.days ?? [], 'days');
  const collectedToday = collections?.breakdown?.total ?? trendDays[0]?.total ?? 0;
  const collectedYesterday = trendDays[1]?.total ?? 0;
  const collectedThisWeek = collectionTrend?.totals?.collected ?? 0;
  const receiptsToday = trendDays[0]?.count ?? 0;

  const billedTotal = invoices.reduce((sum, i) => sum + (i.netAmount ?? i.totalAmount ?? 0), 0);
  const dueTotal = invoices.reduce((sum, i) => sum + (i.dueAmount ?? 0), 0);
  const paidOutToday = collections?.totalPaidOut ?? 0;
  const pendingPayouts = payoutSummary?.pendingCount ?? 0;

  /**
   * The API sends the week newest-first, which is right for a list and wrong
   * for a time axis - a chart drawn from it ran backwards, with today on the
   * left. Reversed here so the line reads left to right into today.
   */
  const chartDays = React.useMemo(
    () =>
      [...trendDays].reverse().map((day: any) => ({
        ...day,
        label: relativeDayLabel(day.date),
        tick: weekdayLabel(day.date),
      })),
    [trendDays]
  );
  const anyPaidOut = chartDays.some((d: any) => (d.paidOut ?? 0) > 0);

  // Each role gets the counters it can actually act on, rather than one
  // undifferentiated grid of every metric in the system.
  const tilesFor = (): Tile[] => {
    switch (role) {
      case 'Phlebotomist':
        return [
          { label: 'Pending collection', value: pendingCollection, icon: Syringe, tone: 'amber', to: '/samples/collection' },
          { label: 'Collected today', value: collected, icon: CheckCircle2, tone: 'emerald', to: '/samples' },
          { label: 'Rejected / recollect', value: rejected, icon: AlertOctagon, tone: 'rose', to: '/samples' },
        ];
      case 'Lab Technician':
        return [
          { label: 'Awaiting processing', value: collected, icon: Microscope, tone: 'amber', to: '/samples/pending' },
          { label: 'In processing', value: processing, icon: Clock, tone: 'blue', to: '/samples' },
          { label: 'Completed', value: completed, icon: CheckCircle2, tone: 'emerald', to: '/results' },
          { label: 'Rejected', value: rejected, icon: AlertOctagon, tone: 'rose', to: '/samples' },
        ];
      case 'Pathologist':
        return [
          { label: 'Awaiting verification', value: pending.length, icon: ClipboardCheck, tone: 'violet', to: '/results/pending' },
          { label: 'In processing', value: processing, icon: Clock, tone: 'blue', to: '/samples' },
          { label: 'Completed', value: completed, icon: FileCheck, tone: 'emerald', to: '/results' },
        ];
      case 'Receptionist':
        return [
          { label: 'Registered patients', value: patientTotal, icon: Users, tone: 'blue', to: '/patients' },
          { label: 'Pending collection', value: pendingCollection, icon: Syringe, tone: 'amber', to: '/samples/collection' },
          { label: 'Collected this week', value: money(collectedThisWeek), icon: Receipt, tone: 'emerald', to: '/billing', hint: 'last 7 days' },
          { label: 'Recent billed', value: money(billedTotal), icon: Receipt, tone: 'slate', to: '/billing', hint: 'last 6 invoices' },
          { label: 'Outstanding due', value: money(dueTotal), icon: IndianRupee, tone: 'rose', to: '/billing', hint: 'last 6 invoices' },
          { label: 'Paid out today', value: money(paidOutToday), icon: Wallet, tone: 'rose', to: '/payouts', hint: 'ambulance, courier, vendors' },
        ];
      case 'Accountant':
        return [
          { label: 'Collected this week', value: money(collectedThisWeek), icon: Receipt, tone: 'emerald', to: '/accounts', hint: 'last 7 days' },
          { label: 'Recent billed', value: money(billedTotal), icon: Receipt, tone: 'slate', to: '/billing', hint: 'last 6 invoices' },
          { label: 'Outstanding due', value: money(dueTotal), icon: IndianRupee, tone: 'rose', to: '/accounts', hint: 'last 6 invoices' },
          { label: 'Paid out today', value: money(paidOutToday), icon: Wallet, tone: 'rose', to: '/payouts' },
          { label: 'Payouts to approve', value: pendingPayouts, icon: ClipboardCheck, tone: 'amber', to: '/payouts' },
        ];
      default:
        return [
          { label: 'Registered patients', value: patientTotal, icon: Users, tone: 'blue', to: '/patients' },
          { label: 'Pending collection', value: pendingCollection, icon: Syringe, tone: 'amber', to: '/samples/collection' },
          { label: 'In processing', value: processing, icon: Microscope, tone: 'violet', to: '/samples/pending' },
          { label: 'Completed', value: completed, icon: CheckCircle2, tone: 'emerald', to: '/results' },
          { label: 'Rejected', value: rejected, icon: AlertOctagon, tone: 'rose', to: '/samples' },
          { label: 'Collected this week', value: money(collectedThisWeek), icon: Receipt, tone: 'emerald', to: '/accounts', hint: 'last 7 days' },
          { label: 'Paid out today', value: money(paidOutToday), icon: Wallet, tone: 'rose', to: '/payouts' },
          { label: 'Payouts to approve', value: pendingPayouts, icon: ClipboardCheck, tone: 'amber', to: '/payouts' },
        ];
    }
  };

  /**
   * The one number the shift leads with, shown large at the top. Everything
   * else on the page is a counter; this is the figure the desk is actually
   * judged on, so it is not left to compete with eight tiles of the same size.
   */
  const heroFor = (): { value: string; label: string; hint: string; delta?: number } => {
    switch (role) {
      case 'Phlebotomist':
        return {
          value: String(pendingCollection),
          label: 'Draws pending collection',
          hint: `${collected} collected so far today`,
        };
      case 'Lab Technician':
        return {
          value: String(collected),
          label: 'Samples awaiting processing',
          hint: `${processing} on the bench · ${completed} completed`,
        };
      case 'Pathologist':
        return {
          value: String(pending.length),
          label: 'Reports awaiting your sign-off',
          hint: `${completed} released · ${processing} still on the bench`,
        };
      default:
        return {
          value: money(collectedToday),
          label: 'Collected today',
          hint: `${receiptsToday} receipt${receiptsToday === 1 ? '' : 's'} · ${money(collectedThisWeek)} this week`,
          // Against yesterday rather than a target - "is today a normal day"
          // is the question actually being asked at the desk.
          delta:
            collectedYesterday > 0
              ? Math.round(((collectedToday - collectedYesterday) / collectedYesterday) * 100)
              : undefined,
        };
    }
  };

  const actionsFor = (): { label: string; to: string; icon: LucideIcon; primary?: boolean }[] => {
    switch (role) {
      case 'Phlebotomist':
        return [
          { label: 'Collection queue', to: '/samples/collection', icon: Syringe, primary: true },
          { label: 'Home collection', to: '/home-collection', icon: Users },
        ];
      case 'Lab Technician':
        return [
          { label: 'Processing queue', to: '/samples/pending', icon: Microscope, primary: true },
          { label: 'Result entry', to: '/results', icon: FileCheck },
        ];
      case 'Pathologist':
        return [
          { label: 'Verify results', to: '/results/pending', icon: ClipboardCheck, primary: true },
          { label: 'All results', to: '/results', icon: FileCheck },
        ];
      case 'Receptionist':
        return [
          { label: 'New visit', to: '/visits/new', icon: Plus, primary: true },
          { label: 'Billing', to: '/billing', icon: Receipt },
          { label: 'Record payout', to: '/payouts', icon: Wallet },
          { label: 'Appointments', to: '/appointments', icon: Clock },
        ];
      case 'Accountant':
        return [
          { label: 'Accounts & refunds', to: '/accounts', icon: IndianRupee, primary: true },
          { label: 'Payouts', to: '/payouts', icon: Wallet },
          { label: 'Reports', to: '/reports', icon: Receipt },
        ];
      default:
        return [
          { label: 'New invoice', to: '/billing/new', icon: Receipt, primary: true },
          { label: 'Add doctor', to: '/doctors', icon: Plus },
          { label: 'Payouts', to: '/payouts', icon: Wallet },
          { label: 'Staff & roles', to: '/staff', icon: Users },
          { label: 'Reports', to: '/reports', icon: TestTube },
        ];
    }
  };

  const intro = ROLE_INTRO[role] ?? ROLE_INTRO.Receptionist;
  const tiles = tilesFor();
  const actions = actionsFor();
  const hero = heroFor();
  const showQueue = needsResults && pending.length > 0;
  const showInvoices = needsBilling;
  const showCollections = needsBilling && chartDays.length > 0;
  // The receptionist sees the same figures but has no accounts screen to be
  // sent to - the money link has to land somewhere their token opens.
  const collectionsLink = hasPermission(user, PERMISSIONS.REFUND_VIEW) ? '/accounts' : '/billing';

  const DeltaChip: React.FC<{ delta: number }> = ({ delta }) => {
    const flat = delta === 0;
    const up = delta > 0;
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          flat ? 'bg-white/10 text-slate-300' : up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'
        }`}
      >
        <Icon className="h-3 w-3" />
        {flat ? 'Same as yesterday' : `${Math.abs(delta)}% vs yesterday`}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* The hero band. One large figure, the shift's name for itself, and the
          actions - so the top of the page says what matters before the grid of
          counters below it starts competing for attention. */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-200 ring-1 ring-inset ring-white/15">
                {role}
              </span>
              <span className="text-[11px] text-slate-400">
                {greeting()}
                {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </span>
            </div>

            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{intro.title}</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400">{intro.subtitle}</p>

            <div className="mt-5">
              <div className="flex flex-wrap items-end gap-3">
                {/* Proportional figures, same sans as the rest - tabular-nums
                    makes a number this size read loose and gappy. */}
                <span className="text-[44px] font-semibold leading-none tracking-tight sm:text-5xl">{hero.value}</span>
                {hero.delta !== undefined && <DeltaChip delta={hero.delta} />}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-300">{hero.label}</p>
              <p className="text-[11px] text-slate-500">{hero.hint}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.to}
                  onClick={() => navigate(a.to)}
                  variant="ghost"
                  className={`h-9 gap-1.5 backdrop-blur-sm ${
                    a.primary
                      ? 'bg-white text-slate-900 shadow-sm hover:bg-slate-100 hover:text-slate-900'
                      : 'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{a.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} tile={tile} onClick={tile.to ? () => navigate(tile.to!) : undefined} />
        ))}
      </div>

      {showCollections && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Collections by day</h2>
              <p className="text-[11px] text-slate-500">
                Last 7 days · {money(collectedThisWeek)} collected
                {anyPaidOut && ` · ${money(collectionTrend?.totals?.paidOut ?? 0)} paid out`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* A legend is present whenever two series are on the plot, so
                  identity never rests on colour-matching alone. */}
              <div className="hidden items-center gap-3 sm:flex">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES[0] }} /> Collected
                </span>
                {anyPaidOut && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES[1] }} /> Paid out
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate(collectionsLink)}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                {collectionsLink === '/accounts' ? 'Accounts' : 'Billing'} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </header>

          {/* Height covers the plot and the weekday band beneath it - sizing
              to the plot alone left the card with its own little scrollbar. */}
          <div className="h-64 w-full px-2 pb-2 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDays} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="paidOutFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[1]} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={SERIES[1]} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="tick" {...axisProps} dy={4} />
                <YAxis {...axisProps} width={56} tickFormatter={compactInr} />
                <Tooltip content={<CollectionsTooltip />} cursor={{ stroke: INK.axis, strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Collected"
                  stroke={SERIES[0]}
                  strokeWidth={2}
                  fill="url(#collectedFill)"
                  dot={{ r: 3, fill: SERIES[0], stroke: INK.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: SERIES[0], stroke: INK.surface, strokeWidth: 2 }}
                />
                {anyPaidOut && (
                  <Area
                    type="monotone"
                    dataKey="paidOut"
                    name="Paid out"
                    stroke={SERIES[1]}
                    strokeWidth={2}
                    fill="url(#paidOutFill)"
                    dot={{ r: 3, fill: SERIES[1], stroke: INK.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: SERIES[1], stroke: INK.surface, strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* The table twin. Every value on the plot is also readable as text,
              so nothing is gated behind a hover. */}
          <details className="border-t border-slate-100">
            <summary className="cursor-pointer select-none px-5 py-2.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700">
              Show the figures
            </summary>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Day</th>
                    <th className="px-3 py-2 text-right font-semibold">Receipts</th>
                    <th className="px-3 py-2 text-right font-semibold">Collected</th>
                    <th className="px-5 py-2 text-right font-semibold">Paid out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trendDays.map((day: any) => (
                    <tr key={day.date} className="hover:bg-slate-50/60">
                      <td className="px-5 py-2 font-medium text-slate-700">
                        {relativeDayLabel(day.date)}
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400">{weekdayLabel(day.date)}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{day.count}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {money(day.total)}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-500">
                        {day.paidOut > 0 ? money(day.paidOut) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <div className={`grid grid-cols-1 gap-4 ${showQueue && showInvoices ? 'lg:grid-cols-2' : ''}`}>
        {showQueue && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                  <ClipboardCheck className="h-4 w-4 text-violet-600" />
                </span>
                <h2 className="text-sm font-semibold text-slate-900">Awaiting verification</h2>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  {pending.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/results/pending')}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </header>
            <ul className="divide-y divide-slate-100">
              {pending.slice(0, 6).map((r: any) => {
                const name = typeof r.patient === 'object' ? r.patient?.patientName ?? '—' : '—';
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{name}</p>
                        <p className="truncate font-mono text-[10px] text-slate-400">{r.uhid ?? r.resultId}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/results/pending')} className="h-7">
                      Review
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {showInvoices && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <Receipt className="h-4 w-4 text-blue-600" />
                </span>
                <h2 className="text-sm font-semibold text-slate-900">Recent invoices</h2>
              </div>
              <button
                onClick={() => navigate('/billing')}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </header>
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <Inbox className="h-7 w-7 text-slate-300" />
                <p className="text-xs text-slate-400">No invoices yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoices.slice(0, 6).map((inv: any) => {
                  const name = typeof inv.patient === 'object' ? inv.patient?.patientName ?? '—' : '—';
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs transition-colors hover:bg-slate-50/60"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{name}</p>
                          <p className="truncate font-mono text-[10px] text-slate-400">{inv.invoiceNumber}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-slate-900">
                          {money(inv.netAmount ?? inv.totalAmount ?? 0)}
                        </p>
                        {(inv.dueAmount ?? 0) > 0 && (
                          <p className="text-[10px] font-medium text-rose-600">Due {money(inv.dueAmount)}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
