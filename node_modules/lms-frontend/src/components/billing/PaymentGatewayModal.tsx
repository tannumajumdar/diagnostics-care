import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentGatewayApi, type PaymentAttempt } from '../../api/paymentGateway.api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { QrCode } from './QrCode';
import { billingApi } from '../../api/billing.api';
import { doctorApi } from '../../api/doctor.api';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { asList } from '../../utils/api-list';
import { catalogueQuery, MONEY_QUERY_KEYS } from '../../utils/query-options';
import type { Doctor } from '../../types';
import {
  Smartphone,
  CreditCard,
  Banknote,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  TimerOff,
  FlaskConical,
  Copy,
  Check,
  BadgePercent,
} from 'lucide-react';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const mmss = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A labelled reference the desk may need to read out or write down. */
const Reference: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => {
  const [copied, setCopied] = React.useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[12px] text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => undefined
          );
        }}
        className={`group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 ${
          mono ? 'font-mono' : ''
        }`}
        title="Copy"
      >
        {value}
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600" />
        ) : (
          <Copy className="h-3 w-3 text-slate-300 group-hover:text-slate-500" />
        )}
      </button>
    </div>
  );
};

/** Everything the desk can settle with from this one dialog. */
type CollectMethod = 'Cash' | 'UPI' | 'Card';

/**
 * What the dialog hands back once the money is in: a gateway attempt, or a
 * cash receipt wearing the same shape so the caller need not care which.
 */
export type CollectedPayment = Omit<PaymentAttempt, 'method'> & { method: CollectMethod };

/**
 * A blank of that shape. Cash fills in the handful of fields it actually has -
 * there is no UTR, no approval code and no expiry on notes across a counter -
 * and the rest stay empty, which is how every reference below hides itself.
 */
const EMPTY_RECEIPT: CollectedPayment = {
  txnId: '',
  payerToken: '',
  method: 'Cash',
  amount: 0,
  status: 'Success',
  pending: false,
  secondsLeft: 0,
  expiresAt: '',
  vpa: '',
  upiIntent: '',
  payeeVpa: '',
  payeeName: '',
  utr: '',
  cardLast4: '',
  cardNetwork: '',
  authCode: '',
  rrn: '',
  failureReason: '',
  completedAt: null,
  receiptNumber: '',
  createdAt: '',
};

export interface PaymentGatewayModalProps {
  invoiceId: string;
  invoiceNumber?: string;
  patientName?: string;
  /** What is still owed. The attempt can be for this or less. */
  dueAmount: number;
  onClose: () => void;
  /** Fired once the money is captured - by the gateway, or across the counter. */
  onCaptured: (attempt: CollectedPayment) => void;
  /**
   * Fired when the bill itself moved from in here - a concession given at the
   * counter - so the screen behind can re-read it even if the patient then
   * walks away without paying.
   */
  onRevised?: () => void;
}

/**
 * Collecting by cash, UPI or card.
 *
 * Cash never touches the gateway - the notes are already in the drawer by the
 * time the desk clicks, so it is written straight onto the bill and the screen
 * goes to the receipt. Only the two machine methods have anything to wait for.
 *
 * The desk does not decide whether this worked - it raises a request and then
 * waits, exactly as it would with a real gateway. The patient acts on their
 * own phone or on the terminal, the server decides, and this screen only ever
 * polls and reports. That is why the "customer" controls sit in their own
 * panel, clearly marked: they are standing in for hardware this build does
 * not have, and they are the only part a live deployment would remove.
 */
export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  invoiceId,
  invoiceNumber,
  patientName,
  dueAmount,
  onClose,
  onCaptured,
  onRevised,
}) => {
  const [method, setMethod] = React.useState<CollectMethod>('UPI');
  /** A settled cash receipt, standing where a gateway attempt would. */
  const [cash, setCash] = React.useState<CollectedPayment | null>(null);
  const [amount, setAmount] = React.useState(String(dueAmount));
  const [vpa, setVpa] = React.useState('');
  const [txnId, setTxnId] = React.useState<string | null>(null);
  const [ticking, setTicking] = React.useState(0);
  const [cardNetwork, setCardNetwork] = React.useState<'RuPay' | 'Visa' | 'Mastercard'>('RuPay');
  const [error, setError] = React.useState('');
  const captured = React.useRef(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /**
   * What is owed as this dialog understands it. It starts as what the screen
   * behind passed in and moves when a concession is given from here, so the
   * amount, the ceiling on it and the line under the heading all keep telling
   * the truth without waiting for the page behind to re-read the bill.
   */
  const [due, setDue] = React.useState(dueAmount);
  React.useEffect(() => setDue(dueAmount), [dueAmount]);

  // Knocking money off a bill is the same right as raising one - a desk that
  // may only take payments does not get these fields at all.
  const canDiscount = hasPermission(user, PERMISSIONS.BILL_CREATE);
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [discountType, setDiscountType] = React.useState<'Percentage' | 'Fixed'>('Fixed');
  const [discountValue, setDiscountValue] = React.useState('0');
  const [discountDoctorId, setDiscountDoctorId] = React.useState('');
  const [discountDoctorName, setDiscountDoctorName] = React.useState('');
  const [discountReason, setDiscountReason] = React.useState('');
  const [discountError, setDiscountError] = React.useState('');
  /** What the last concession given from here came to, once it is on the bill. */
  const [discountGiven, setDiscountGiven] = React.useState<{ label: string; through: string } | null>(null);
  const prefilled = React.useRef(false);

  /**
   * Polled only while something is actually in flight. A settled attempt is
   * final, so there is nothing left to ask the server about.
   */
  const { data: attempt } = useQuery({
    queryKey: ['payment-attempt', txnId],
    queryFn: () => paymentGatewayApi.getStatus(txnId!),
    enabled: !!txnId,
    refetchInterval: (query) => (query.state.data?.pending ? 2000 : false),
    refetchOnWindowFocus: true,
  });

  // The countdown runs off the browser's clock between polls, and is corrected
  // by every poll - the server's expiry is the one that actually counts.
  React.useEffect(() => {
    if (!attempt?.pending) return;
    setTicking(attempt.secondsLeft);
    const timer = setInterval(() => setTicking((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [attempt?.secondsLeft, attempt?.pending]);

  /**
   * What the screen actually draws. Cash settles in one call and has nothing
   * to poll, so its receipt is dropped in here and every panel below reads the
   * same shape whichever way the money came in.
   */
  const view: CollectedPayment | undefined = cash ?? attempt;

  // Handing the captured payment back exactly once, however many polls land.
  React.useEffect(() => {
    if (view?.status === 'Success' && !captured.current) {
      captured.current = true;
      onCaptured(view);
    }
  }, [view, onCaptured]);

  const initiate = useMutation({
    mutationFn: () =>
      paymentGatewayApi.initiate({
        invoiceId,
        amount: Number(amount),
        method: method as 'UPI' | 'Card',
        vpa: method === 'UPI' && vpa.trim() ? vpa.trim() : undefined,
      }),
    onSuccess: (res) => {
      setError('');
      captured.current = false;
      // Seeded so the QR is on screen immediately. Without this the modal has
      // nothing to render between the request landing and the first poll
      // coming back, and blinks empty for a beat.
      queryClient.setQueryData(['payment-attempt', res.txnId], res);
      setTxnId(res.txnId);
    },
    onError: (err: any) => setError(err?.message || 'Could not start this payment'),
  });

  const simulate = useMutation({
    onSuccess: (res) => queryClient.setQueryData(['payment-attempt', res.txnId], res),
    mutationFn: (payload: { outcome: 'success' | 'failure'; reason?: string }) =>
      paymentGatewayApi.simulate(txnId!, {
        token: attempt?.payerToken || '',
        ...payload,
        ...(method === 'Card' && payload.outcome === 'success'
          ? { cardNetwork, cardLast4: String(Math.floor(1000 + Math.random() * 9000)) }
          : {}),
        ...(method === 'UPI' && payload.outcome === 'success' && !vpa.trim()
          ? { vpa: 'patient@demoupi' }
          : {}),
      }),
  });

  /**
   * Cash is already in the drawer, so there is no request to raise and nothing
   * to wait for - it is written onto the bill and the screen goes straight to
   * the receipt the desk hands over.
   */
  const collectCash = useMutation({
    mutationFn: () => billingApi.addPayment(invoiceId, { amount: Number(amount), paymentMethod: 'Cash' }),
    onSuccess: (res: any) => {
      setError('');
      const record = res?.paymentRecord;
      setCash({
        ...EMPTY_RECEIPT,
        method: 'Cash',
        amount: Number(record?.amount ?? amount) || Number(amount),
        receiptNumber: record?.receiptNumber || '',
        completedAt: record?.createdAt || new Date().toISOString(),
        createdAt: record?.createdAt || new Date().toISOString(),
      });
    },
    onError: (err: any) => setError(err?.message || 'Could not record this payment'),
  });

  /* ------------------------------------------------------------------ */
  /* A concession given while the patient is standing at the counter      */
  /* ------------------------------------------------------------------ */

  /**
   * The bill itself, read only once the desk asks for the discount fields -
   * taking money needs nothing from it, and most collections never open them.
   */
  const { data: billData } = useQuery({
    queryKey: ['invoice-details', invoiceId],
    queryFn: () => billingApi.getInvoiceById(invoiceId),
    enabled: discountOpen,
  });
  const bill = billData?.invoice;

  const { data: doctorsData } = useQuery({
    queryKey: ['discount-doctors'],
    queryFn: () => doctorApi.getAll({ limit: 200, status: 'Active' }),
    enabled: discountOpen,
    ...catalogueQuery,
  });

  /**
   * A discount already on the bill is what the desk is editing rather than
   * something to add to - the server re-prices the whole bill from the figure
   * it is sent - so the panel opens showing what the bill already carries.
   */
  React.useEffect(() => {
    if (!bill || prefilled.current) return;
    prefilled.current = true;
    setDiscountType((bill.discountType as 'Percentage' | 'Fixed') || 'Fixed');
    setDiscountValue(String(Number(bill.discountValue) || 0));
    setDiscountReason(bill.discountReason || '');
    const doctor = bill.discountDoctor;
    setDiscountDoctorId(
      doctor && typeof doctor === 'object' ? String(doctor.id || doctor._id || '') : String(doctor || '')
    );
    setDiscountDoctorName(bill.discountDoctorName || '');
  }, [bill]);

  /**
   * What the bill would come to with this concession on it, worked out the way
   * the server does: what the desk knocked off each test comes off first, and
   * the bill-wide discount lands on what is left. The counter sees the figure
   * before it commits, and cancelled lines keep what the centre retained.
   */
  const preview = React.useMemo(() => {
    if (!bill) return null;
    const items: any[] = bill.items || [];
    const live = items.filter((item) => !item.cancelled);
    const subtotal = live.reduce((sum: number, item: any) => sum + (Number(item.rate) || 0), 0);
    const lineDiscount = live.reduce(
      (sum: number, item: any) => sum + (Number(item.lineDiscountAmount ?? item.discountAmount) || 0),
      0
    );
    const base = Math.max(0, subtotal - lineDiscount);
    const value = Math.max(0, Number(discountValue) || 0);
    const billDiscount =
      discountType === 'Percentage' ? (base * Math.min(100, value)) / 100 : Math.min(base, value);
    const retained = items
      .filter((item: any) => item.cancelled)
      .reduce((sum: number, item: any) => sum + (Number(item.retainedAmount) || 0), 0);
    const net = Math.max(0, base - billDiscount) + retained;
    const paid = Number(bill.paidAmount) || 0;
    return {
      billDiscount,
      net,
      due: Math.max(0, net - paid),
      // Money already in the drawer cannot be discounted away - it goes back
      // through the refund desk, where it is receipted.
      belowPaid: net < paid,
      paid,
    };
  }, [bill, discountType, discountValue]);

  const applyDiscount = useMutation({
    mutationFn: () =>
      billingApi.reviseInvoice(invoiceId, {
        discountType,
        discountValue: Math.max(0, Number(discountValue) || 0),
        discountReason: discountReason.trim(),
        // Sent even when empty, so clearing the doctor on a bill that had one
        // actually clears it rather than leaving the old name behind.
        discountDoctorId: discountDoctorId || '',
        discountDoctorName: discountDoctorId ? undefined : discountDoctorName.trim(),
        revisionNote: 'Discount given at the counter while collecting',
      }),
    onSuccess: (res: any) => {
      setDiscountError('');
      setError('');
      const nextDue = Math.max(0, Number(res?.dueAmount ?? 0));
      setDue(nextDue);
      setAmount(String(nextDue));
      setDiscountOpen(false);
      const value = Math.max(0, Number(discountValue) || 0);
      setDiscountGiven({
        label: discountType === 'Percentage' ? `${value}% off this bill` : `${money(value)} off this bill`,
        through: res?.invoice?.discountDoctorName || '',
      });
      // The bill, the directory and the day's figures all moved.
      queryClient.invalidateQueries({ queryKey: ['invoice-details', invoiceId] });
      MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      onRevised?.();
    },
    onError: (err: any) => setDiscountError(err?.message || 'Could not put this discount on the bill'),
  });

  const cancel = useMutation({
    mutationFn: () => paymentGatewayApi.cancel(txnId!),
    onSuccess: (res) => queryClient.setQueryData(['payment-attempt', res.txnId], res),
  });

  const retry = () => {
    setTxnId(null);
    setCash(null);
    captured.current = false;
    setError('');
  };

  const status = view?.status;
  const live = !!view?.pending;
  const settled = !!view && !view.pending;
  const won = status === 'Success';

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= due;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Collect payment</h2>
            <p className="truncate text-[12px] text-slate-500">
              {patientName ? `${patientName} · ` : ''}
              {invoiceNumber} · {money(due)} due
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Setting the attempt up                                            */}
        {/* ---------------------------------------------------------------- */}
        {!txnId && !cash && (
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Method</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'Cash' as const, label: 'Cash', hint: 'Into the drawer', icon: Banknote },
                  { key: 'UPI' as const, label: 'UPI', hint: 'Scan or collect request', icon: Smartphone },
                  { key: 'Card' as const, label: 'Card', hint: 'On the POS terminal', icon: CreditCard },
                ]).map((option) => {
                  const Icon = option.icon;
                  const active = method === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setMethod(option.key)}
                      className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-900">{option.label}</span>
                        <span className="block text-[11px] text-slate-500">{option.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Amount</label>
              <Input
                type="number"
                value={amount}
                min={1}
                max={due}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
              {!amountValid && amount !== '' && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">
                  Enter an amount between ₹1 and {money(due)}.
                </p>
              )}
            </div>

            {/* -------------------------------------------------------- */}
            {/* A concession settled at the counter, before the money      */}
            {/* -------------------------------------------------------- */}
            {canDiscount && !discountOpen && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                <div className="min-w-0">
                  {discountGiven ? (
                    <>
                      <p className="text-[12px] font-semibold text-emerald-700">
                        {discountGiven.label} — now {money(due)} due
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {discountGiven.through ? `Through ${discountGiven.through}` : "The centre's own concession"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12px] font-semibold text-slate-700">Discount</p>
                      <p className="text-[11px] text-slate-500">
                        Promised a concession? Put it on the bill before taking the money.
                      </p>
                    </>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setDiscountOpen(true)} className="shrink-0">
                  <BadgePercent className="mr-1.5 h-3.5 w-3.5" />
                  {discountGiven ? 'Change' : 'Give a discount'}
                </Button>
              </div>
            )}

            {canDiscount && discountOpen && (
              <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  <BadgePercent className="h-3 w-3" />
                  Discount on this bill
                </p>

                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'Percentage' | 'Fixed')}
                    className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="Fixed">Fixed (₹)</option>
                    <option value="Percentage">Percent (%)</option>
                  </select>
                  <Input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                {/* Whose concession this is. A bill discounted on one doctor's
                    word has to be able to say so months later. */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">Discount given through</label>
                  <select
                    value={discountDoctorId}
                    onChange={(e) => {
                      setDiscountDoctorId(e.target.value);
                      if (e.target.value) setDiscountDoctorName('');
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="">Centre&rsquo;s own concession / not through a doctor</option>
                    {asList<Doctor>(doctorsData, 'doctors').map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.doctorName}
                        {doctor.specialty ? ` · ${doctor.specialty}` : ''}
                      </option>
                    ))}
                  </select>
                  {!discountDoctorId && (
                    <Input
                      value={discountDoctorName}
                      onChange={(e) => setDiscountDoctorName(e.target.value)}
                      placeholder="Or type a doctor who is not on the panel"
                      className="mt-1.5 h-9"
                    />
                  )}
                </div>

                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Reason for the discount"
                  className="h-9"
                />

                {preview && (
                  <div className="rounded-lg bg-white/70 px-2.5 py-2 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>Bill discount</span>
                      <span className="font-mono font-semibold text-emerald-700">- {money(preview.billDiscount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bill after discount</span>
                      <span className="font-mono">{money(preview.net)}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
                      <span>Left to collect</span>
                      <span className="font-mono">{money(preview.due)}</span>
                    </div>
                  </div>
                )}

                {preview?.belowPaid && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800">
                    This brings the bill below the {money(preview.paid)} already collected. Refund the difference from
                    Accounts instead, so the money leaving the drawer is receipted.
                  </p>
                )}

                {discountError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700">
                    {discountError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDiscountError('');
                      setDiscountOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!bill || applyDiscount.isPending || Boolean(preview?.belowPaid)}
                    isLoading={applyDiscount.isPending}
                    onClick={() => applyDiscount.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Apply to bill
                  </Button>
                </div>
              </div>
            )}

            {due <= 0 && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
                Nothing left to collect on this bill.
              </p>
            )}

            {method === 'UPI' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Patient's UPI id <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  placeholder="name@bank — leave blank to show a QR instead"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  With an id, a collect request goes to their app. Without one, they scan the QR.
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!amountValid || initiate.isPending || collectCash.isPending}
                isLoading={initiate.isPending || collectCash.isPending}
                onClick={() => (method === 'Cash' ? collectCash.mutate() : initiate.mutate())}
              >
                {method === 'Cash' ? 'Record' : method === 'UPI' ? 'Request' : 'Send to terminal'}{' '}
                {amountValid ? money(amountNum) : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* In flight - the desk is waiting on the payer                      */}
        {/* ---------------------------------------------------------------- */}
        {live && attempt && (
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {attempt.method === 'UPI'
                  ? attempt.vpa
                    ? 'Waiting for the patient to approve'
                    : 'Waiting for the patient to scan'
                  : 'Waiting for the card on the terminal'}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-blue-700">
                <Clock className="h-3 w-3" />
                {mmss(ticking)}
              </span>
            </div>

            {attempt.method === 'UPI' && !attempt.vpa && attempt.upiIntent && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4">
                <QrCode value={attempt.upiIntent} size={196} label={`UPI payment QR for ${money(attempt.amount)}`} />
                <p className="text-lg font-semibold tracking-tight text-slate-900">{money(attempt.amount)}</p>
                <p className="font-mono text-[12px] text-slate-500">{attempt.payeeVpa}</p>
                <p className="text-[11px] text-slate-400">Any UPI app — GPay, PhonePe, Paytm, BHIM</p>
              </div>
            )}

            {attempt.method === 'UPI' && attempt.vpa && (
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <Smartphone className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{money(attempt.amount)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Request sent to <span className="font-mono font-semibold text-slate-700">{attempt.vpa}</span>
                </p>
              </div>
            )}

            {attempt.method === 'Card' && (
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <CreditCard className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{money(attempt.amount)}</p>
                <p className="mt-0.5 text-xs text-slate-500">Ask the patient to tap, dip or swipe.</p>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <Reference label="Reference" value={attempt.txnId} />
            </div>

            {/* The stand-in for hardware this build does not have. */}
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                <FlaskConical className="h-3 w-3" />
                Simulator — the patient's side
              </p>
              <p className="mb-2.5 text-[11px] leading-relaxed text-amber-800">
                Standing in for the patient's phone and the card terminal. With a live gateway the outcome arrives from
                the bank and this panel is gone.
              </p>

              {attempt.method === 'Card' && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-amber-800">Card</span>
                  <select
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value as typeof cardNetwork)}
                    className="h-7 rounded-lg border border-amber-300 bg-white px-2 text-[12px]"
                  >
                    <option value="RuPay">RuPay</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={simulate.isPending}
                  onClick={() => simulate.mutate({ outcome: 'success' })}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {attempt.method === 'UPI' ? 'Patient pays' : 'Approved card'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulate.isPending}
                  onClick={() =>
                    simulate.mutate({
                      outcome: 'failure',
                      reason:
                        attempt.method === 'UPI'
                          ? 'Insufficient balance in the payer account'
                          : 'Card declined by the issuing bank',
                    })
                  }
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  {attempt.method === 'UPI' ? 'Patient declines' : 'Declined card'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
                className="text-slate-600"
              >
                Cancel this attempt
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Settled                                                           */}
        {/* ---------------------------------------------------------------- */}
        {settled && view && (
          <div className="space-y-4 px-5 py-5">
            <div className="text-center">
              {won ? (
                <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" />
              ) : status === 'Expired' ? (
                <TimerOff className="mx-auto h-11 w-11 text-amber-500" />
              ) : (
                <XCircle className="mx-auto h-11 w-11 text-rose-500" />
              )}
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                {won ? `${money(view.amount)} received` : `Payment ${status?.toLowerCase()}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {won
                  ? `Paid by ${view.method === 'Card' ? `${view.cardNetwork} card` : view.method}`
                  : view.failureReason || 'The attempt did not go through.'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <Reference label="Reference" value={view.txnId} />
              {won && view.method === 'UPI' && <Reference label="UTR" value={view.utr} />}
              {won && view.method === 'Card' && (
                <>
                  <Reference label="Card" value={view.cardLast4 ? `•••• ${view.cardLast4}` : ''} />
                  <Reference label="Approval code" value={view.authCode} />
                  <Reference label="RRN" value={view.rrn} />
                </>
              )}
              {won && <Reference label="Receipt" value={view.receiptNumber} />}
            </div>

            {won && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                Booked against {invoiceNumber} and counted in today's collections.
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              {!won && (
                <Button variant="outline" onClick={retry}>
                  Try again
                </Button>
              )}
              <Button onClick={onClose}>{won ? 'Done' : 'Close'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentGatewayModal;
