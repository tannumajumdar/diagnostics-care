import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, CreatePayoutParams } from '../../api/accounts.api';
import { patientApi } from '../../api/patient.api';
import { doctorApi } from '../../api/doctor.api';
import { PAYEE_TYPES, PayeeType, PayoutRecord, PayoutSummary, Patient, Doctor } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { asList } from '../../utils/api-list';
import { exportToExcel } from '../../utils/excel-export';
import {
  Wallet,
  Plus,
  Ambulance,
  Check,
  X,
  Download,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import { DISBURSEMENT_METHODS } from '../../config/payment-methods';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const todayIso = () => new Date().toISOString().split('T')[0];
const monthStartIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const STATUS_BADGE: Record<string, 'success' | 'amber' | 'destructive'> = {
  Paid: 'success',
  Pending: 'amber',
  Rejected: 'destructive',
};

const emptyForm = {
  payeeType: 'Ambulance' as PayeeType,
  payeeName: '',
  payeeContact: '',
  description: '',
  amount: '',
  paymentMethod: 'Cash',
  referenceNo: '',
  expenseDate: todayIso(),
  patientId: '',
  doctorId: '',
};

/**
 * The outgoing-cash desk. A receptionist records what was handed to the
 * ambulance driver or the courier and can see the running total; an Admin also
 * clears anything parked for approval and can strike a wrong entry.
 */
export const PayoutsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const canApprove = hasPermission(user, PERMISSIONS.PAYOUT_APPROVE);
  const canDelete = hasPermission(user, PERMISSIONS.PAYOUT_DELETE);
  const canRecord = hasPermission(user, PERMISSIONS.PAYOUT_CREATE);

  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const filters = { from, to, payeeType: typeFilter || undefined, status: statusFilter || undefined, payeeName: nameFilter || undefined, limit: 100 };

  const { data: summary } = useQuery<PayoutSummary>({
    queryKey: ['payout-summary', from, to],
    queryFn: () => accountsApi.getPayoutSummary({ from, to }),
  });

  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ['payouts', filters],
    queryFn: () => accountsApi.getAllPayouts(filters),
  });

  // Linking a payout back to the visit it belongs to is optional, so these
  // lookups stay small and are only used to fill the two pickers.
  const { data: patientsData } = useQuery({
    queryKey: ['patients-payout-lookup'],
    queryFn: () => patientApi.getAll({ limit: 100 }),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-payout-lookup'],
    queryFn: () => doctorApi.getAll({ limit: 100, status: 'Active' }),
    enabled: form.payeeType === 'Doctor Referral',
  });

  const payouts = asList<PayoutRecord>(payoutsData, 'payouts');

  const createMutation = useMutation({
    mutationFn: (data: CreatePayoutParams) => accountsApi.createPayout(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-summary'] });
      queryClient.invalidateQueries({ queryKey: ['daily-collections'] });
      setIsFormOpen(false);
      setForm({ ...emptyForm });
      showToast(
        res?.status === 'Pending'
          ? `Recorded and sent to the Admin for approval (${money(res.amount)})`
          : `Payout of ${money(res?.amount)} recorded`,
        'success'
      );
    },
    onError: (err: any) => showToast(err?.message || 'Could not record this payout', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'Paid' | 'Rejected'; rejectionReason?: string }) =>
      accountsApi.updatePayoutStatus(id, { status, rejectionReason }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-summary'] });
      showToast(`Payout marked ${res?.status}`, 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Could not update this payout', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.deletePayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-summary'] });
      showToast('Payout record deleted', 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Could not delete this payout', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      payeeType: form.payeeType,
      payeeName: form.payeeName.trim(),
      payeeContact: form.payeeContact || undefined,
      description: form.description.trim(),
      amount: Number(form.amount),
      paymentMethod: form.paymentMethod,
      referenceNo: form.referenceNo || undefined,
      expenseDate: form.expenseDate || undefined,
      patientId: form.patientId || undefined,
      doctorId: form.payeeType === 'Doctor Referral' ? form.doctorId || undefined : undefined,
    });
  };

  const handleReject = (payout: PayoutRecord) => {
    const reason = window.prompt(`Why is the payout to ${payout.payeeName} being rejected?`);
    if (!reason) return;
    statusMutation.mutate({ id: payout._id, status: 'Rejected', rejectionReason: reason });
  };

  const ambulanceTotal = useMemo(
    () => summary?.byType?.find((row) => row.payeeType === 'Ambulance')?.total ?? 0,
    [summary]
  );

  const handleExport = () => {
    exportToExcel(
      `payouts-${from}-to-${to}`,
      payouts.map((p) => ({
        'Payout ID': p.expenseId,
        Date: new Date(p.expenseDate).toLocaleDateString('en-IN'),
        'Paid To': p.payeeName,
        Type: p.payeeType,
        Purpose: p.description,
        Amount: p.amount,
        Method: p.paymentMethod,
        Status: p.status,
        'Recorded By': p.recordedBy?.name ?? '',
        'Approved By': p.approvedBy?.name ?? '',
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Wallet className="h-6 w-6 text-rose-600" />
            <span>Payouts &amp; Cash Paid Out</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Every rupee handed out - ambulance, courier, referral cuts and suppliers - with a running total per payee.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!payouts.length}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          {canRecord && (
            <Button onClick={() => setIsFormOpen(true)} className="bg-rose-600 hover:bg-rose-700">
              <Plus className="mr-1 h-4 w-4" /> Record Payout
            </Button>
          )}
        </div>
      </div>

      {/* Period selector - every figure below is scoped to this window */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6 text-xs">
          <div>
            <label className="mb-1 block font-semibold">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block font-semibold">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Paid To</label>
            <Input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Name of person or vendor"
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-2"
            >
              <option value="">All types</option>
              {PAYEE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-2"
            >
              <option value="">All</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending approval</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Headline totals */}
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Card className="border-rose-200 bg-gradient-to-br from-rose-600 to-rose-700 p-3 text-white">
          <span className="text-[11px] font-bold uppercase opacity-90">Total Paid Out</span>
          <span className="mt-1 block font-mono text-lg font-bold">{money(summary?.totalPaid ?? 0)}</span>
          <span className="text-[11px] opacity-80">{summary?.paidCount ?? 0} payments</span>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 p-3">
          <span className="text-[11px] font-bold uppercase text-muted-foreground">Awaiting Approval</span>
          <span className="mt-1 block font-mono text-lg font-bold text-amber-700">
            {money(summary?.totalPending ?? 0)}
          </span>
          <span className="text-[11px] text-muted-foreground">{summary?.pendingCount ?? 0} pending</span>
        </Card>
        <Card className="border-sky-200 bg-sky-50/50 p-3">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground">
            <Ambulance className="h-3 w-3" /> Ambulance
          </span>
          <span className="mt-1 block font-mono text-lg font-bold text-sky-700">{money(ambulanceTotal)}</span>
          <span className="text-[11px] text-muted-foreground">this period</span>
        </Card>
        <Card className="border-slate-200 bg-slate-50/50 p-3">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground">
            <TrendingDown className="h-3 w-3" /> Daily Average
          </span>
          <span className="mt-1 block font-mono text-lg font-bold text-slate-700">
            {money(Math.round((summary?.totalPaid ?? 0) / Math.max(1, summary?.byDay?.length ?? 1)))}
          </span>
          <span className="text-[11px] text-muted-foreground">over {summary?.byDay?.length ?? 0} active days</span>
        </Card>
      </div>

      {/* Pending approvals sit at the top so the Admin sees them first */}
      {canApprove && (summary?.pendingApprovals?.length ?? 0) > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Payouts Awaiting Your Approval ({summary?.pendingApprovals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-xs">
            {summary?.pendingApprovals.map((p) => (
              <div
                key={p._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-amber-50/40 p-3"
              >
                <div>
                  <p className="font-bold">
                    {p.payeeName} <span className="font-normal text-muted-foreground">· {p.payeeType}</span>
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {p.description} · filed by {p.recordedBy?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-rose-600">{money(p.amount)}</span>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ id: p._id, status: 'Paid' })}
                  >
                    <Check className="mr-1 h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(p)}>
                    <X className="mr-1 h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Who was paid, and how much in total */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold">Paid By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-xs">
            {(summary?.byType?.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-muted-foreground">Nothing paid out in this period.</p>
            ) : (
              summary?.byType.map((row) => {
                const share = summary.totalPaid ? Math.round((row.total / summary.totalPaid) * 100) : 0;
                return (
                  <div key={row.payeeType} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{row.payeeType}</span>
                      <span className="font-mono font-bold text-rose-600">{money(row.total)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${share}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {row.count} payment{row.count === 1 ? '' : 's'} · {share}% of total
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold">Top Payees</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Paid To</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Payments</th>
                  <th className="p-3">Total Given</th>
                  <th className="p-3">Last Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(summary?.byPayee?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No payees in this period.
                    </td>
                  </tr>
                ) : (
                  summary?.byPayee.map((row) => (
                    <tr key={`${row.payeeName}-${row.payeeType}`} className="hover:bg-muted/30">
                      <td className="p-3 font-bold">{row.payeeName}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{row.payeeType}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{row.count}</td>
                      <td className="p-3 font-mono font-bold text-rose-600">{money(row.total)}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(row.lastPaidAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* The ledger itself */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Payout Ledger ({payouts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Payout ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Paid To</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Recorded By</th>
                  {(canApprove || canDelete) && <th className="p-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      Loading payouts...
                    </td>
                  </tr>
                ) : payouts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      No payouts recorded for this filter.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-purple-600">{p.expenseId}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(p.expenseDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-3">
                        <p className="font-bold">{p.payeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{p.payeeType}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {p.description}
                        {p.patient?.patientName && (
                          <span className="block text-[11px] font-semibold text-blue-600">
                            {p.patient.patientName} ({p.patient.uhid})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-rose-600">{money(p.amount)}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{p.paymentMethod}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={STATUS_BADGE[p.status] ?? 'secondary'}>{p.status}</Badge>
                        {p.status === 'Rejected' && p.rejectionReason && (
                          <span className="block text-[11px] text-muted-foreground">{p.rejectionReason}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{p.recordedBy?.name}</td>
                      {(canApprove || canDelete) && (
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {canApprove && p.status === 'Pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => statusMutation.mutate({ id: p._id, status: 'Paid' })}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleReject(p)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => {
                                  if (window.confirm(`Delete payout ${p.expenseId}? This cannot be undone.`)) {
                                    deleteMutation.mutate(p._id);
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record a payout */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-bold text-foreground">Record Money Paid Out</h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">Paid For *</label>
                  <select
                    value={form.payeeType}
                    onChange={(e) => setForm({ ...form, payeeType: e.target.value as PayeeType })}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                  >
                    {PAYEE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Date</label>
                  <Input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  />
                </div>
              </div>

              {form.payeeType === 'Doctor Referral' ? (
                <div>
                  <label className="mb-1 block font-semibold">Referring Doctor *</label>
                  <select
                    value={form.doctorId}
                    onChange={(e) => {
                      const doc = asList<Doctor>(doctorsData, 'doctors').find((d) => d.id === e.target.value);
                      setForm({ ...form, doctorId: e.target.value, payeeName: doc?.doctorName ?? '' });
                    }}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                    required
                  >
                    <option value="">Select doctor</option>
                    {asList<Doctor>(doctorsData, 'doctors').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.doctorName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold">Paid To *</label>
                    <Input
                      value={form.payeeName}
                      onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                      placeholder="e.g. Sharma Ambulance Service"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold">Contact</label>
                    <Input
                      value={form.payeeContact}
                      onChange={(e) => setForm({ ...form, payeeContact: e.target.value })}
                      placeholder="Mobile number"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block font-semibold">What is this payment for? *</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Home sample pickup - Sector 12 round trip"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">Amount (₹) *</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                  >
                    {DISBURSEMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Ref / UTR</label>
                  <Input
                    value={form.referenceNo}
                    onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold">Link to a patient visit</label>
                <select
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="h-10 w-full rounded-xl border bg-background px-3"
                >
                  <option value="">Not linked to a specific patient</option>
                  {asList<Patient>(patientsData, 'patients').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientName} ({p.uhid})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Useful when the ambulance ran for one patient - the payment then shows on their record.
                </p>
              </div>

              {!canApprove && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-800">
                  Payouts above the petty-cash limit are filed for Admin approval instead of being settled straight away.
                </p>
              )}

              <div className="flex justify-end gap-2 border-t pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-rose-600 hover:bg-rose-700">
                  Record Payout
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
