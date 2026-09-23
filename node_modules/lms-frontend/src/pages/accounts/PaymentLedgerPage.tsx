import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { accountsApi, type LedgerFilters } from '../../api/accounts.api';
import { patientApi } from '../../api/patient.api';
import { userApi } from '../../api/user.api';
import { asList } from '../../utils/api-list';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect';
import { PatientLedgerBill } from '../../components/billing/PatientLedgerBill';
import { exportToExcel } from '../../utils/excel-export';
import { formatDay, formatDateTime, relativeDayLabel, todayKey, daysAgoKey } from '../../utils/dates';
import { ageSexLabel } from '../../utils/age';
import {
  BookOpen,
  Printer,
  Download,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  IndianRupee,
  Calendar,
  Wallet,
  User,
  UserCheck,
  RotateCcw,
  Search,
  Receipt,
  Building2,
  Stethoscope,
  RefreshCw,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  COLLECTION_METHODS,
  FILTER_PAYMENT_METHODS,
  DISBURSEMENT_METHODS,
  methodLabel,
  methodColor,
} from '../../config/payment-methods';
import { PAYEE_TYPES, type Patient } from '../../types';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const todayIso = () => new Date().toISOString().split('T')[0];
const monthStartIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

export const PaymentLedgerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialPatientId = searchParams.get('patientId') || '';

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [from, setFrom] = useState(initialPatientId ? '' : monthStartIso());
  const [to, setTo] = useState(initialPatientId ? '' : todayIso());
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [handledBy, setHandledBy] = useState('All');
  const [staffSelectValue, setStaffSelectValue] = useState('All');
  const [customStaffName, setCustomStaffName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [flowType, setFlowType] = useState<'all' | 'collection' | 'payout' | 'refund'>('all');
  const [payeeType, setPayeeType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'daywise'>('transactions');

  // Fetch center users/staff for the User / Handled By filter
  const { data: usersData } = useQuery({
    queryKey: ['users-list-ledger'],
    queryFn: () => userApi.getAll({ limit: 100 }),
    staleTime: 60000,
  });

  const staffList = asList(usersData, 'users');

  // Fetch patient profile if patientId was passed in query params
  const { data: initialPatientData } = useQuery({
    queryKey: ['patient-ledger-lookup', initialPatientId],
    queryFn: () => patientApi.getById(initialPatientId),
    enabled: !!initialPatientId && !selectedPatient,
  });

  React.useEffect(() => {
    if (initialPatientData && !selectedPatient) {
      setSelectedPatient(initialPatientData as Patient);
    }
  }, [initialPatientData, selectedPatient]);

  const activePatientId = selectedPatient?.id || (selectedPatient as any)?._id || initialPatientId || undefined;

  const filters: LedgerFilters = {
    patientId: activePatientId,
    search: searchQuery.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
    fromTime: fromTime.trim() || undefined,
    toTime: toTime.trim() || undefined,
    handledBy: handledBy !== 'All' && handledBy.trim() ? handledBy.trim() : undefined,
    paymentMethod: paymentMethod !== 'All' ? paymentMethod : undefined,
    flowType: flowType !== 'all' ? flowType : undefined,
    payeeType: payeeType !== 'All' ? payeeType : undefined,
    limit: 100,
  };

  const { data: ledgerData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['accounts-ledger', filters],
    queryFn: () => accountsApi.getLedger(filters),
    refetchInterval: 20000,
  });

  const summary = ledgerData?.summary || {
    totalCollections: 0,
    totalPayouts: 0,
    netBalance: 0,
    totalCount: 0,
    collectionCount: 0,
    payoutCount: 0,
  };

  const todaySummary = ledgerData?.todaySummary || {
    date: todayKey(),
    collections: 0,
    payouts: 0,
    net: 0,
    collectionCount: 0,
    payoutCount: 0,
    totalCount: 0,
    byMethod: {},
  };

  const byDay: any[] = ledgerData?.byDay || [];
  const transactions: any[] = ledgerData?.transactions || [];
  const patientProfile = ledgerData?.patient || selectedPatient;
  const patientSummary = ledgerData?.patientSummary;
  const patientInvoices: any[] = ledgerData?.invoices || [];

  const isViewingToday = from === todayIso() && to === todayIso() && !fromTime && !toTime;

  const filterTodayOnly = () => {
    setFrom(todayIso());
    setTo(todayIso());
    setFromTime('');
    setToTime('');
    setActiveTab('transactions');
  };

  const handleFilterDay = (dayDate: string) => {
    setFrom(dayDate);
    setTo(dayDate);
    setFromTime('');
    setToTime('');
    setActiveTab('transactions');
  };

  const showAllDays = () => {
    setFrom(monthStartIso());
    setTo(todayIso());
    setFromTime('');
    setToTime('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (activeTab === 'daywise') {
      const dayRows = byDay.map((d: any, index: number) => ({
        Sr: index + 1,
        Date: formatDay(d.date),
        Day: relativeDayLabel(d.date),
        Collections_Inflow: d.collections,
        Receipt_Count: d.collectionCount,
        Payouts_Outflow: d.payouts,
        Payout_Count: d.payoutCount,
        Net_Cash_Flow: d.net,
        Total_Records: d.totalCount,
        Methods: Object.entries(d.byMethod || {})
          .map(([m, amt]) => `${m}: ₹${amt}`)
          .join(', '),
      }));

      exportToExcel(
        `DayWise_Collection_${activePatientId ? patientProfile?.patientName : 'All'}_${from || 'start'}_${to || 'today'}`,
        dayRows
      );
      return;
    }

    const rows = transactions.map((t: any, index: number) => ({
      Sr: index + 1,
      Date: formatDateTime(t.date),
      Flow: t.flow === 'INFLOW' ? 'Receipt (Inflow)' : 'Payout (Outflow)',
      Type: t.type,
      Party: t.partyName,
      UHID: t.partyUhid || '-',
      Mobile: t.partyMobile || '-',
      Receipt_Voucher: t.receiptNumber || '-',
      Invoice_No: t.invoiceNumber || '-',
      Method: methodLabel(t.paymentMethod),
      Amount: t.amount,
      Txn_Ref: t.transactionRef || t.notes || '-',
      Handled_By: t.handledBy || '-',
    }));

    const timeSuffix = fromTime || toTime ? `_${fromTime || '0000'}-${toTime || '2359'}` : '';
    const staffSuffix = handledBy && handledBy !== 'All' ? `_Staff-${handledBy.replace(/\s+/g, '_')}` : '';
    exportToExcel(
      `Ledger_Report_${activePatientId ? patientProfile?.patientName : 'All'}_${from}_${to}${timeSuffix}${staffSuffix}`,
      rows
    );
  };

  const clearFilters = () => {
    setSelectedPatient(null);
    setSearchParams({});
    setFrom(monthStartIso());
    setTo(todayIso());
    setFromTime('');
    setToTime('');
    setHandledBy('All');
    setStaffSelectValue('All');
    setCustomStaffName('');
    setPaymentMethod('All');
    setFlowType('all');
    setPayeeType('All');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* ── Screen Page Header (Hidden when printing) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            <span>Payment Ledger &amp; Cash Flow</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track individual patient payment history, collections by method, and centre payouts to doctors,
            ambulances, and refunds with full Ledger Bill printing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {activePatientId && (
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 font-semibold hover:bg-indigo-700 shadow-xs text-xs sm:text-sm h-9"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Print Ledger Bill
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={transactions.length === 0}
            className={`text-xs sm:text-sm h-9 ${!activePatientId ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <Download className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* ── Comprehensive Filters Card (Hidden when printing) ── */}
      <Card className="border-slate-200 shadow-xs print:hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-2.5 pt-2.5 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>Filter Ledger Records</span>
            </CardTitle>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset All</span>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3.5 p-3 sm:p-5">
          {/* Row 1: Patient Filter & Staff / User Filter (Shift Cashier) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 1. Patient Picker */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Filter by Patient (Select for Patient Ledger Bill)
              </label>
              <PatientSearchSelect
                value={selectedPatient}
                onChange={(p) => {
                  setSelectedPatient(p);
                  if (p?.id) {
                    setSearchParams({ patientId: p.id });
                  } else {
                    setSearchParams({});
                  }
                }}
              />
            </div>

            {/* 2. Staff / User Filter (Shift Cashier) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Filter by Staff / User (Shift Cashier)</span>
                </label>
                {handledBy !== 'All' && (
                  <button
                    type="button"
                    onClick={() => {
                      setHandledBy('All');
                      setStaffSelectValue('All');
                      setCustomStaffName('');
                    }}
                    className="text-[10px] font-semibold text-rose-600 hover:underline"
                  >
                    Clear Staff
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={staffSelectValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStaffSelectValue(val);
                    if (val === 'CUSTOM') {
                      setHandledBy(customStaffName);
                    } else {
                      setHandledBy(val);
                    }
                  }}
                  className="h-9 flex-1 rounded-lg border border-slate-300 bg-background px-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Staff / Users (Entire Center)</option>
                  {staffList.map((u: any) => (
                    <option key={u.id || u._id} value={u.name}>
                      {u.name} — {u.role || 'Staff'}
                    </option>
                  ))}
                  <option value="CUSTOM">Type Name Manually / Search Name...</option>
                </select>
                {staffSelectValue === 'CUSTOM' && (
                  <Input
                    type="text"
                    placeholder="Type cashier name..."
                    value={customStaffName}
                    onChange={(e) => {
                      setCustomStaffName(e.target.value);
                      setHandledBy(e.target.value);
                    }}
                    className="h-9 w-44 text-xs font-medium"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Date & Shift Time (Separated columns - Full year 100% visible, no clipping) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* 1: From Date */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-600" />
                <span>From Date</span>
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 text-xs w-full min-w-[140px] px-2.5 font-medium text-slate-900"
              />
            </div>

            {/* 2: From Time (Shift Start) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="h-3 w-3 text-indigo-600" />
                <span>From Time (Shift Start)</span>
              </label>
              <Input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="h-9 text-xs w-full px-2.5 font-medium text-slate-900"
                placeholder="00:00"
                title="Shift Start Time (e.g. 07:00 AM)"
              />
            </div>

            {/* 3: To Date */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-600" />
                <span>To Date</span>
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 text-xs w-full min-w-[140px] px-2.5 font-medium text-slate-900"
              />
            </div>

            {/* 4: To Time (Shift End) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="h-3 w-3 text-indigo-600" />
                <span>To Time (Shift End)</span>
              </label>
              <Input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="h-9 text-xs w-full px-2.5 font-medium text-slate-900"
                placeholder="23:59"
                title="Shift End Time (e.g. 02:00 PM)"
              />
            </div>
          </div>

          {/* Row 3: Quick Shift Timing Presets Row */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3 text-indigo-600" />
                <span>Shift Timing Presets:</span>
              </span>
              <button
                type="button"
                onClick={() => { setFromTime(''); setToTime(''); }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium border transition-colors ${
                  !fromTime && !toTime
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Day (Full 24h)
              </button>
              <button
                type="button"
                onClick={() => { setFromTime('07:00'); setToTime('14:00'); }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium border transition-colors ${
                  fromTime === '07:00' && toTime === '14:00'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Morning Shift (07:00 - 14:00)
              </button>
              <button
                type="button"
                onClick={() => { setFromTime('14:00'); setToTime('21:00'); }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium border transition-colors ${
                  fromTime === '14:00' && toTime === '21:00'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Evening Shift (14:00 - 21:00)
              </button>
              <button
                type="button"
                onClick={() => { setFromTime('21:00'); setToTime('07:00'); }}
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium border transition-colors ${
                  fromTime === '21:00' && toTime === '07:00'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Night Shift (21:00 - 07:00)
              </button>
              {(fromTime || toTime) && (
                <button
                  type="button"
                  onClick={() => { setFromTime(''); setToTime(''); }}
                  className="text-[11px] px-2 py-0.5 text-rose-600 hover:underline font-semibold"
                >
                  Clear Shift Time ({fromTime || '00:00'} - {toTime || '23:59'})
                </button>
              )}
            </div>
            {(fromTime || toTime) && (
              <span className="text-[11px] text-indigo-600 font-medium">
                Active shift window: <strong>{fromTime || '00:00'}</strong> to <strong>{toTime || '23:59'}</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {/* 4. Payment Method Filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                <option value="All">All Methods (Cash, UPI, Card, Split...)</option>
                <option value="Split">Split Payment (Cash + UPI, etc.)</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Online">Online</option>
                <option value="Credit">Credit (pay later)</option>
              </select>
            </div>

            {/* 5. Flow Type Filter */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Transaction Flow</label>
              <select
                value={flowType}
                onChange={(e) => setFlowType(e.target.value as any)}
                className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                <option value="all">All Flows (Inflows + Outflows)</option>
                <option value="collection">Collections (Patient Receipts)</option>
                <option value="payout">All Outflows (Payouts &amp; Refunds)</option>
                <option value="refund">Patient Refunds Only</option>
              </select>
            </div>

            {/* 6. Payee Type */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Payout Recipient / Payee Type
              </label>
              <select
                value={payeeType}
                onChange={(e) => setPayeeType(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                <option value="All">All Payees / Recipients</option>
                <option value="Patient Refund">Patient Refund</option>
                <option value="Doctor Referral">Doctor Referral Cut</option>
                <option value="Ambulance">Ambulance</option>
                <option value="Courier">Courier</option>
                <option value="Supplier">Supplier / Lab Consumables</option>
                <option value="Staff Salary">Staff / Salary</option>
                <option value="Other Expense">Other Expense</option>
              </select>
            </div>

            {/* 7. Search Text */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Keyword Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Receipt #, Bill #, Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Today's Live Collection Summary Banner ── */}
      <Card className="border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 shadow-xs print:hidden">
        <CardContent className="p-3.5 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-indigo-100/70 pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Calendar className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Today's Live Collection Summary
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE DAILY UPDATES
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {formatDay(new Date())} · Real-time auto-updating center collection &amp; daily cash flow
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {isViewingToday ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold py-1">
                  Viewing Today's Transactions
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={filterTodayOnly}
                  className="h-8 text-xs font-semibold border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                  Filter Today in Ledger
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh Live Data"
                className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Today KPI Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-3">
            {/* 1. Today Collections */}
            <div className="rounded-xl border border-emerald-200 bg-white p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3 text-emerald-600" /> Today's Inflow
              </span>
              <p className="mt-1 text-base sm:text-xl font-bold text-emerald-700 font-mono">
                {money(todaySummary.collections)}
              </p>
              <p className="text-[10px] font-medium text-emerald-600">
                {todaySummary.collectionCount} receipt{todaySummary.collectionCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* 2. Today Outflows */}
            <div className="rounded-xl border border-rose-200 bg-white p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-rose-600" /> Today's Outflows
              </span>
              <p className="mt-1 text-base sm:text-xl font-bold text-rose-700 font-mono">
                {money(todaySummary.payouts)}
              </p>
              <p className="text-[10px] font-medium text-rose-600">
                {todaySummary.payoutCount} payout/refund{todaySummary.payoutCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* 3. Today Net Cash */}
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <IndianRupee className="h-3 w-3 text-slate-500" /> Today's Net Balance
              </span>
              <p className={`mt-1 text-base sm:text-xl font-bold font-mono ${todaySummary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {money(todaySummary.net)}
              </p>
              <p className="text-[10px] font-medium text-slate-500">
                Net Cash Flow Today
              </p>
            </div>

            {/* 4. Payment Methods Breakdown Today */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">
                Today By Method
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {Object.keys(todaySummary.byMethod || {}).length > 0 ? (
                  Object.entries(todaySummary.byMethod).map(([m, amt]) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-800 shadow-2xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: methodColor(m) }} />
                      <span className="text-slate-600">{methodLabel(m)}:</span>
                      <span className="font-bold font-mono">{money(amt as number)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No collections yet today</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPI Tiles (Hidden when printing) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 print:hidden">
        <div className="rounded-xl sm:rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-800">Collections (Inflow)</span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700">
              <ArrowDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight text-emerald-900 truncate">
            {money(summary.totalCollections)}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-700 truncate">
            {summary.collectionCount} receipt{summary.collectionCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-rose-200/80 bg-rose-50/50 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-800">Payouts &amp; Refunds</span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-rose-100 text-rose-700">
              <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight text-rose-900 truncate">
            {money(summary.totalPayouts)}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-rose-700 truncate">
            {summary.payoutCount} payout/refund{summary.payoutCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700">Net Cash Flow</span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-slate-700">
              <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight truncate ${summary.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(summary.netBalance)}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">
            Filtered period net
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Total Entries</span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-slate-700">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            {summary.totalCount}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">
            Matching active filters
          </p>
        </div>
      </div>

      {/* ── Active Patient Ledger Banner (if a patient is selected) ── */}
      {selectedPatient && patientProfile && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 shadow-xs print:hidden">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 font-bold text-xs">
                    {patientProfile.uhid || 'Pt. Reg'}
                  </Badge>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">{patientProfile.patientName}</h2>
                  <span className="text-xs text-slate-500">({ageSexLabel(patientProfile)})</span>
                </div>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-600">
                  Mobile: <span className="font-semibold">{patientProfile.mobile || '-'}</span> ·
                  Address: {patientProfile.address || 'Not specified'}
                </p>
              </div>

              {patientSummary && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
                    <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-center shadow-2xs">
                      <span className="block text-[10px] text-slate-500 uppercase">Total Billed</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{money(patientSummary.totalBilled)}</span>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center shadow-2xs">
                      <span className="block text-[10px] text-emerald-700 uppercase">Total Paid</span>
                      <span className="font-bold text-emerald-900 text-xs sm:text-sm">{money(patientSummary.totalPaid)}</span>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-center shadow-2xs">
                      <span className="block text-[10px] text-rose-700 uppercase">Refunded</span>
                      <span className="font-bold text-rose-900 text-xs sm:text-sm">{money(patientSummary.totalRefunded || 0)}</span>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center shadow-2xs">
                      <span className="block text-[10px] text-amber-800 uppercase">Balance Due</span>
                      <span className="font-bold text-red-600 text-xs sm:text-sm">{money(patientSummary.balanceDue)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handlePrint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-3 text-xs w-full sm:w-auto"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Print Ledger Bill
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Date, Time & Staff Filter Notice ── */}
      {((from && to && from === to) || fromTime || toTime || (handledBy && handledBy !== 'All')) && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs text-indigo-900 print:hidden flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              {from && to && from === to ? (
                <>Filtered Day: <strong>{formatDay(from)}</strong> ({relativeDayLabel(from)})</>
              ) : (
                <>Period: <strong>{formatDay(from)}</strong> to <strong>{formatDay(to)}</strong></>
              )}
              {(fromTime || toTime) && (
                <span className="ml-1.5 inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                  <Clock className="h-3 w-3" />
                  Shift: {fromTime || '00:00'} - {toTime || '23:59'}
                </span>
              )}
              {handledBy && handledBy !== 'All' && (
                <span className="ml-1.5 inline-flex items-center gap-1 font-semibold text-indigo-800 bg-indigo-200/80 px-2 py-0.5 rounded-md">
                  <UserCheck className="h-3 w-3 text-indigo-700" />
                  Staff: <strong>{handledBy}</strong>
                </span>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={showAllDays}
            className="h-7 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100/60"
          >
            Show All Days ({formatDay(monthStartIso())} - Today)
          </Button>
        </div>
      )}

      {/* ── Ledger View Switcher Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2 print:hidden">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'transactions'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>All Transactions</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-semibold">
              {transactions.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('daywise')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'daywise'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Day-Wise Collection</span>
            <Badge
              variant="secondary"
              className="ml-1 text-[10px] px-1.5 py-0 font-semibold bg-indigo-50 text-indigo-700"
            >
              {byDay.length} Days
            </Badge>
          </button>
        </div>

        <span className="text-xs text-muted-foreground hidden sm:block">
          {activeTab === 'transactions'
            ? 'Itemized patient receipts & disbursement vouchers'
            : 'Aggregated daily collections, outflows & net cash breakdown'}
        </span>
      </div>

      {activeTab === 'daywise' ? (
        <Card className="border-slate-200 shadow-xs print:hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-2.5 pt-2.5 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Day-Wise Daily Collection Summary ({byDay.length} Days)</span>
              </CardTitle>
              <span className="text-[11px] font-medium text-slate-500">
                Period: {from ? formatDay(from) : 'Start'} to {to ? formatDay(to) : 'Today'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* 1. Mobile Cards for Day-Wise */}
            <div className="block md:hidden divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Loading day-wise collections...
                </div>
              ) : byDay.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No day-wise collection records found for the selected period.
                </div>
              ) : (
                byDay.map((day: any) => {
                  const isToday = day.date === todayKey();
                  const isYesterday = day.date === daysAgoKey(1);

                  return (
                    <div key={day.date} className="p-3.5 hover:bg-slate-50 transition-colors space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {formatDay(day.date)}
                          </span>
                          {isToday && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                              Today
                            </Badge>
                          )}
                          {isYesterday && (
                            <Badge variant="outline" className="text-slate-600 text-[10px] px-1.5 py-0 font-medium">
                              Yesterday
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Net Balance</span>
                          <span className={`font-mono font-bold text-xs ${day.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {money(day.net)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
                          <span className="text-[10px] font-semibold text-emerald-800 block">Collections (Inflow)</span>
                          <span className="font-bold font-mono text-emerald-700 text-xs sm:text-sm">{money(day.collections)}</span>
                          <span className="text-[10px] text-emerald-600 block">{day.collectionCount} receipt{day.collectionCount === 1 ? '' : 's'}</span>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2">
                          <span className="text-[10px] font-semibold text-rose-800 block">Payouts &amp; Refunds</span>
                          <span className="font-bold font-mono text-rose-700 text-xs sm:text-sm">{money(day.payouts)}</span>
                          <span className="text-[10px] text-rose-600 block">{day.payoutCount} payout{day.payoutCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>

                      {/* Payment Methods breakdown */}
                      {Object.keys(day.byMethod || {}).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {Object.entries(day.byMethod).map(([m, amt]) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700"
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: methodColor(m) }} />
                              {methodLabel(m)}: <span className="font-bold font-mono">{money(amt as number)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFilterDay(day.date)}
                          className="w-full h-8 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        >
                          View {day.totalCount} Day's Transactions
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. Desktop Table for Day-Wise */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Collections (Inflow)</th>
                    <th className="px-4 py-3 text-right">Payouts &amp; Refunds</th>
                    <th className="px-4 py-3 text-right">Net Cash Flow</th>
                    <th className="px-4 py-3">Methods Breakdown</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading day-wise collections...
                      </td>
                    </tr>
                  ) : byDay.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No day-wise collection records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    byDay.map((day: any) => {
                      const isToday = day.date === todayKey();
                      const isYesterday = day.date === daysAgoKey(1);

                      return (
                        <tr key={day.date} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{formatDay(day.date)}</span>
                              {isToday && (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                                  Today
                                </Badge>
                              )}
                              {isYesterday && (
                                <Badge variant="outline" className="text-slate-600 text-[10px] px-1.5 py-0 font-medium">
                                  Yesterday
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {day.totalCount} total record{day.totalCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="font-mono font-bold text-emerald-700 text-sm">
                              +{money(day.collections)}
                            </span>
                            <span className="block text-[11px] text-emerald-600">
                              {day.collectionCount} receipt{day.collectionCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="font-mono font-bold text-rose-700 text-sm">
                              {day.payouts > 0 ? `-${money(day.payouts)}` : '₹0'}
                            </span>
                            <span className="block text-[11px] text-rose-600">
                              {day.payoutCount} payout{day.payoutCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`font-mono font-bold text-sm ${day.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {money(day.net)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5 max-w-[340px]">
                              {Object.keys(day.byMethod || {}).length > 0 ? (
                                Object.entries(day.byMethod).map(([m, amt]) => (
                                  <span
                                    key={m}
                                    className="inline-flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-800"
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: methodColor(m) }}
                                    />
                                    <span>{methodLabel(m)}:</span>
                                    <span className="font-mono font-bold">{money(amt as number)}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFilterDay(day.date)}
                              className="h-7 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                            >
                              View Transactions
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {byDay.length > 0 && (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs">
                    <tr>
                      <td className="px-4 py-3 text-slate-700">PERIOD TOTALS ({byDay.length} DAYS):</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700 text-sm">
                        +{money(summary.totalCollections)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-700 text-sm">
                        -{money(summary.totalPayouts)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${summary.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {money(summary.netBalance)}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-right text-slate-500">
                        {summary.totalCount} total entries
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Detailed Ledger Table (Desktop) & Cards (Mobile) ── */
        <Card className="border-slate-200 shadow-xs print:hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-2.5 pt-2.5 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-800">
              {selectedPatient
                ? `Patient Receipts & Refunds (${transactions.length})`
                : `All Ledger Transactions (${transactions.length})`}
            </CardTitle>
            <span className="text-[11px] font-medium text-slate-500">
              {transactions.length} record{transactions.length === 1 ? '' : 's'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* 1. Mobile Cards View (Visible on phones & small screens < md) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Loading ledger records...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No transactions found matching the selected filters.
              </div>
            ) : (
              transactions.map((t: any, idx: number) => {
                const isInflow = t.flow === 'INFLOW';
                const isRefund = t.type === 'Patient Refund';

                return (
                  <div key={t.id || idx} className="p-3.5 hover:bg-slate-50 transition-colors space-y-2">
                    {/* Top Row: Flow Badge, Date & Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant={isInflow ? 'success' : isRefund ? 'secondary' : 'destructive'}
                          className={`font-bold text-[10px] px-2 py-0.5 ${
                            !isInflow && isRefund ? 'bg-rose-100 text-rose-800 border-rose-200' : ''
                          }`}
                        >
                          {isInflow ? 'Receipt' : isRefund ? 'Refund' : 'Payout'}
                        </Badge>
                        <span className="text-[11px] font-medium text-slate-500">
                          {formatDateTime(t.date)}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono font-bold text-sm">
                        {isInflow ? (
                          <span className="text-emerald-600">+{money(t.amount)}</span>
                        ) : (
                          <span className="text-rose-600">-{money(t.amount)}</span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Party Name & UHID/Mobile */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{t.partyName}</p>
                        {(t.partyUhid || t.partyMobile) && (
                          <p className="text-[10px] text-slate-500 truncate">
                            {t.partyUhid} {t.partyMobile ? `· ${t.partyMobile}` : ''}
                          </p>
                        )}
                      </div>
                      {/* Payment Method Pill & Split Indicator */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: methodColor(t.paymentMethod) }}
                          />
                          {methodLabel(t.paymentMethod)}
                          {t.isSplit && (
                            <span className="text-[9px] font-bold text-violet-700 ml-0.5">
                              (Split)
                            </span>
                          )}
                        </span>
                        {t.isSplit && t.splitSummary && (
                          <span
                            className="text-[9px] text-violet-600 font-medium truncate max-w-[140px] text-right mt-0.5"
                            title={t.splitSummary}
                          >
                            {t.splitSummary}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Receipt/Bill & Category/Notes & Handled By */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex-wrap gap-1">
                      <div className="font-mono text-[10px] text-slate-600 truncate max-w-[50%]">
                        {t.receiptNumber && <span>Rec: {t.receiptNumber}</span>}
                        {t.invoiceNumber && t.invoiceNumber !== '-' && (
                          <span className="ml-1 text-slate-400">· Bill: {t.invoiceNumber}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium truncate text-right flex items-center gap-1.5 ml-auto">
                        {t.handledBy && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            <UserCheck className="h-2.5 w-2.5 text-indigo-600" />
                            {t.handledBy}
                          </span>
                        )}
                        <span>{t.type}</span>
                        {t.notes && <span className="text-slate-400 ml-0.5 truncate">({t.notes})</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Footer Total summary */}
            {transactions.length > 0 && (
              <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">Totals:</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-emerald-700">+{money(summary.totalCollections)}</span>
                  <span className="text-rose-700">-{money(summary.totalPayouts)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Desktop Table View (Hidden on mobile phones, visible on md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Flow</th>
                  <th className="px-4 py-3">Receipt / Ref #</th>
                  <th className="px-4 py-3">Party / Patient</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Category / Details</th>
                  <th className="px-4 py-3">Handled By</th>
                  <th className="px-4 py-3 text-right">Inflow (+)</th>
                  <th className="px-4 py-3 text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Loading ledger records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No transactions found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t: any) => {
                    const isInflow = t.flow === 'INFLOW';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {formatDateTime(t.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            variant={isInflow ? 'success' : t.type === 'Patient Refund' ? 'secondary' : 'destructive'}
                            className={`font-semibold text-[10px] ${
                              !isInflow && t.type === 'Patient Refund'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : ''
                            }`}
                          >
                            {isInflow ? 'Receipt' : t.type === 'Patient Refund' ? 'Refund' : 'Payout'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {t.receiptNumber || '-'}
                          {t.invoiceNumber && t.invoiceNumber !== '-' && (
                            <span className="block text-[10px] font-normal text-slate-400">
                              Bill: {t.invoiceNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{t.partyName}</p>
                          {(t.partyUhid || t.partyMobile) && (
                            <p className="text-[10px] text-slate-500">
                              {t.partyUhid} {t.partyMobile ? `· ${t.partyMobile}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: methodColor(t.paymentMethod) }}
                              />
                              <span className="font-medium text-slate-800">
                                {methodLabel(t.paymentMethod)}
                              </span>
                              {t.isSplit && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-[9px] px-1.5 py-0 font-bold bg-violet-50 text-violet-700 border-violet-200"
                                >
                                  Split
                                </Badge>
                              )}
                            </span>
                            {t.isSplit && t.splitSummary && (
                              <span
                                className="text-[10px] text-violet-600 font-medium mt-0.5"
                                title={t.splitSummary}
                              >
                                {t.splitSummary}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[240px]">
                          <span
                            className={`font-semibold ${
                              t.type === 'Patient Refund' ? 'text-rose-700' : 'text-slate-800'
                            }`}
                          >
                            {t.type}
                          </span>
                          {t.notes && (
                            <span className="block text-[11px] text-slate-500 truncate" title={t.notes}>
                              {t.notes}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {t.handledBy ? (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              <UserCheck className="h-3 w-3 text-indigo-600" />
                              {t.handledBy}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                          {isInflow ? money(t.amount) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                          {!isInflow ? money(t.amount) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {transactions.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right text-slate-700">
                      PAGE TOTALS:
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">
                      {money(summary.totalCollections)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700">
                      {money(summary.totalPayouts)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* ── Printable Patient Ledger Bill (Activated on Print) ── */}
      {selectedPatient && patientProfile && (
        <div className="hidden print:block">
          <PatientLedgerBill
            patient={patientProfile}
            invoices={patientInvoices}
            transactions={transactions}
            summary={patientSummary}
            periodLabel={from && to ? `${formatDay(from)} to ${formatDay(to)}` : 'Complete Account History'}
          />
        </div>
      )}
    </div>
  );
};

export default PaymentLedgerPage;
