import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, CreateRefundParams } from '../../api/accounts.api';
import { billingApi } from '../../api/billing.api';
import {
  DailyCollectionSummary,
  RefundRecord,
  DoctorCommissionReport,
  Invoice,
} from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { IndianRupee, RefreshCw, Wallet } from 'lucide-react';
import {
  COLLECTION_METHODS,
  DISBURSEMENT_METHODS,
  METHOD_FIELD,
  methodColor,
  methodLabel,
} from '../../config/payment-methods';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'collections' | 'refunds' | 'commissions'>('collections');

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<any>('Cash');

  const { data: collectionsData } = useQuery<DailyCollectionSummary>({
    queryKey: ['daily-collections'],
    queryFn: () => accountsApi.getDailyCollections(),
  });

  const { data: refundsData } = useQuery({
    queryKey: ['refunds-list'],
    queryFn: () => accountsApi.getAllRefunds(),
  });

  const { data: commissionsData } = useQuery({
    queryKey: ['doctor-commissions'],
    queryFn: () => accountsApi.getDoctorCommissions(),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-refund-lookup'],
    queryFn: () => billingApi.getAllInvoices({ limit: 50 }),
  });

  const refunds = asList<RefundRecord>(refundsData, 'refunds');

  const refundMutation = useMutation({
    mutationFn: (data: CreateRefundParams) => accountsApi.createRefund(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds-list'] });
      queryClient.invalidateQueries({ queryKey: ['daily-collections'] });
      setIsRefundModalOpen(false);
      setSelectedInvoiceId('');
      setRefundAmount(0);
      setRefundReason('');
      showToast('Refund issued and the invoice updated', 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Failed to issue refund', 'error'),
  });

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refundMutation.mutate({
      invoiceId: selectedInvoiceId,
      refundAmount: Number(refundAmount),
      reason: refundReason,
      paymentMethod: refundMethod,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <IndianRupee className="h-6 w-6 text-emerald-600" />
            <span>Accounts &amp; Refunds</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Money coming in: collections by method, authorised refunds and doctor commission earned against paid.
          </p>
        </div>

        <div className="flex gap-2">
          {/* Money going out has its own desk. */}
          <Link to="/payouts">
            <Button variant="outline">
              <Wallet className="mr-1 h-4 w-4" /> Payouts
            </Button>
          </Link>
          <Button onClick={() => setIsRefundModalOpen(true)} className="bg-amber-600 hover:bg-amber-700">
            <RefreshCw className="mr-1 h-4 w-4" /> Issue Refund
          </Button>
        </div>
      </div>

      <div className="flex gap-4 border-b text-xs font-semibold">
        {(
          [
            ['collections', 'Daily Collections'],
            ['refunds', `Refund Registry (${refunds.length})`],
            ['commissions', 'Doctor Commissions'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`border-b-2 pb-2 transition-colors ${
              activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'collections' && collectionsData && (
        <div className="space-y-6">
          {/* One card per method on the shared list, so a method added there
              shows up on the drawer count without this grid being edited. A
              method nobody used today still shows its zero - an empty slot is
              information when you are reconciling. */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
            {COLLECTION_METHODS.map((method) => {
              const Icon = method.icon;
              const amount = (collectionsData.breakdown as Record<string, number>)[METHOD_FIELD[method.value]] ?? 0;
              return (
                <Card key={method.value} className="p-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: methodColor(method.value) }} />
                    <span className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                      {method.label}
                    </span>
                    <Icon className="ml-auto h-3 w-3 shrink-0 text-slate-300" />
                  </span>
                  <span
                    className={`mt-1 block font-mono text-base font-bold ${
                      amount > 0 ? 'text-slate-900' : 'text-slate-300'
                    }`}
                  >
                    {money(amount)}
                  </span>
                </Card>
              );
            })}

            <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 p-3 text-white">
              <span className="text-[10px] font-bold uppercase opacity-90">Collected</span>
              <span className="mt-1 block font-mono text-base font-bold">
                {money(collectionsData.breakdown.total)}
              </span>
            </Card>

            {/* Collections minus the day's payouts - what should be in hand. */}
            <Card className="border-slate-300 bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Net In Hand</span>
              <span className="mt-1 block font-mono text-base font-bold text-slate-800">
                {money(collectionsData.netInHand)}
              </span>
              <span className="text-[10px] text-rose-600">
                less {money(collectionsData.totalPaidOut)} paid out
              </span>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">
                Payments Received Today ({collectionsData.payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b bg-muted/50 font-semibold">
                  <tr>
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Amount Received</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border">
                  {asList(collectionsData, 'payments').map((p: any) => (
                    <tr key={p._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-blue-600">{p.receiptNumber}</td>
                      <td className="p-3 font-bold">{p.patient?.patientName || 'N/A'}</td>
                      <td className="p-3 font-mono font-bold text-emerald-600">{money(p.amount)}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{methodLabel(p.paymentMethod)}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(p.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'refunds' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Authorised Refunds</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Refund ID</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Original Amt</th>
                  <th className="p-3">Refunded Amt</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No refunds issued yet.
                    </td>
                  </tr>
                ) : (
                  refunds.map((r) => (
                    <tr key={r._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-amber-600">{r.refundId}</td>
                      <td className="p-3 font-mono font-bold text-blue-600">{r.invoice?.invoiceNumber || 'N/A'}</td>
                      <td className="p-3 font-bold">{r.patient?.patientName || 'N/A'}</td>
                      <td className="p-3 font-mono">{money(r.originalAmount)}</td>
                      <td className="p-3 font-mono font-bold text-red-600">{money(r.refundAmount)}</td>
                      <td className="p-3 text-muted-foreground">{r.reason}</td>
                      <td className="p-3 text-muted-foreground">
                        {r.approvedBy?.name} ({r.approvedBy?.role})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'commissions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Doctor Referral Commission Ledger</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Paid is what has actually gone out on the payout ledger against each doctor.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Doctor Name</th>
                  <th className="p-3">Referred Tests</th>
                  <th className="p-3">Total Revenue</th>
                  <th className="p-3">Commission %</th>
                  <th className="p-3">Earned</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {asList<DoctorCommissionReport>(commissionsData, 'commissions').map((c) => (
                  <tr key={c.doctorId} className="hover:bg-muted/30">
                    <td className="p-3 font-bold">{c.doctorName}</td>
                    <td className="p-3 font-semibold text-blue-600">{c.totalReferredTests} Tests</td>
                    <td className="p-3 font-mono font-bold">{money(c.totalRevenue)}</td>
                    <td className="p-3 font-semibold text-purple-600">{c.commissionPercentage}%</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">{money(c.commissionEarned)}</td>
                    <td className="p-3 font-mono text-emerald-600">{money(c.commissionPaid)}</td>
                    <td className="p-3 font-mono font-bold text-amber-600">{money(c.commissionPending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-bold text-foreground">Issue Patient Refund</h2>
              <button
                onClick={() => setIsRefundModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold">Select Paid Invoice *</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedInvoiceId(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3"
                  required
                >
                  <option value="">Select Invoice</option>
                  {asList<Invoice>(invoicesData, 'invoices').map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.invoiceNumber} - Paid: {money(inv.paidAmount)} ({inv.patient?.patientName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold">Refund Amount (₹) *</label>
                <Input
                  type="number"
                  value={refundAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefundAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold">Reason for Refund *</label>
                <Input
                  value={refundReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefundReason(e.target.value)}
                  placeholder="e.g. Test cancelled by patient"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold">Refund Payment Method</label>
                <select
                  value={refundMethod}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRefundMethod(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3"
                >
                  {DISBURSEMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t pt-2">
                <Button type="button" variant="outline" onClick={() => setIsRefundModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={refundMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
                  Confirm Refund
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
