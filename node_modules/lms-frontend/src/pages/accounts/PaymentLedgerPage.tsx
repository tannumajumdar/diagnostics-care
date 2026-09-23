import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { accountsApi, type LedgerFilters } from '../../api/accounts.api';
import { patientApi } from '../../api/patient.api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect';
import { PatientLedgerBill } from '../../components/billing/PatientLedgerBill';
import { exportToExcel } from '../../utils/excel-export';
import { formatDay, formatDateTime } from '../../utils/dates';
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
  RotateCcw,
  Search,
  Receipt,
  Building2,
  Stethoscope,
} from 'lucide-react';
import {
  COLLECTION_METHODS,
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
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [flowType, setFlowType] = useState<'all' | 'collection' | 'payout' | 'refund'>('all');
  const [payeeType, setPayeeType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

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
    paymentMethod: paymentMethod !== 'All' ? paymentMethod : undefined,
    flowType: flowType !== 'all' ? flowType : undefined,
    payeeType: payeeType !== 'All' ? payeeType : undefined,
    limit: 100,
  };

  const { data: ledgerData, isLoading, refetch } = useQuery({
    queryKey: ['accounts-ledger', filters],
    queryFn: () => accountsApi.getLedger(filters),
  });

  const summary = ledgerData?.summary || {
    totalCollections: 0,
    totalPayouts: 0,
    netBalance: 0,
    totalCount: 0,
    collectionCount: 0,
    payoutCount: 0,
  };

  const transactions: any[] = ledgerData?.transactions || [];
  const patientProfile = ledgerData?.patient || selectedPatient;
  const patientSummary = ledgerData?.patientSummary;
  const patientInvoices: any[] = ledgerData?.invoices || [];

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
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

    exportToExcel(
      `Ledger_Report_${activePatientId ? patientProfile?.patientName : 'All'}_${from}_${to}`,
      rows
    );
  };

  const clearFilters = () => {
    setSelectedPatient(null);
    setSearchParams({});
    setFrom(monthStartIso());
    setTo(todayIso());
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
        <CardContent className="space-y-3 p-3 sm:p-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Patient Picker */}
            <div className="sm:col-span-2">
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

            {/* 2 & 3: Date From & To in a 2-col subgrid on mobile */}
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">From Date</label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">To Date</label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
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
                <option value="All">All Methods (Cash, UPI, Card...)</option>
                {COLLECTION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
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

      {/* ── Summary KPI Tiles (Hidden when printing) ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 print:hidden">
        <div className="rounded-xl sm:rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-800">Collections</span>
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

        <div className="col-span-2 sm:col-span-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs flex sm:block items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600">Total Entries</span>
            <p className="mt-0.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
              {summary.totalCount}
            </p>
            <p className="hidden sm:block mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">Matching active filters</p>
          </div>
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-slate-700 sm:hidden">
            <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
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

      {/* ── Detailed Ledger Table (Desktop) & Cards (Mobile) ── */}
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
                      {/* Payment Method Pill */}
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: methodColor(t.paymentMethod) }}
                        />
                        {methodLabel(t.paymentMethod)}
                      </span>
                    </div>

                    {/* Bottom Row: Receipt/Bill & Category/Notes */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                      <div className="font-mono text-[10px] text-slate-600 truncate max-w-[50%]">
                        {t.receiptNumber && <span>Rec: {t.receiptNumber}</span>}
                        {t.invoiceNumber && t.invoiceNumber !== '-' && (
                          <span className="ml-1 text-slate-400">· Bill: {t.invoiceNumber}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium truncate text-right">
                        <span>{t.type}</span>
                        {t.notes && <span className="text-slate-400 ml-1 truncate">({t.notes})</span>}
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
                  <th className="px-4 py-3 text-right">Inflow (+)</th>
                  <th className="px-4 py-3 text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Loading ledger records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
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
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: methodColor(t.paymentMethod) }}
                            />
                            <span className="font-medium text-slate-800">
                              {methodLabel(t.paymentMethod)}
                            </span>
                          </span>
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
                    <td colSpan={6} className="px-4 py-3 text-right text-slate-700">
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
