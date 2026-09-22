import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentGatewayApi, type PaymentAttempt } from '../../api/paymentGateway.api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { QrCode } from './QrCode';
import {
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  TimerOff,
  FlaskConical,
  Copy,
  Check,
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
      <span className="text-[11px] text-slate-500">{label}</span>
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

export interface PaymentGatewayModalProps {
  invoiceId: string;
  invoiceNumber?: string;
  patientName?: string;
  /** What is still owed. The attempt can be for this or less. */
  dueAmount: number;
  onClose: () => void;
  /** Fired once the gateway confirms the money was captured. */
  onCaptured: (attempt: PaymentAttempt) => void;
}

/**
 * Collecting by UPI or card.
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
}) => {
  const [method, setMethod] = React.useState<'UPI' | 'Card'>('UPI');
  const [amount, setAmount] = React.useState(String(dueAmount));
  const [vpa, setVpa] = React.useState('');
  const [txnId, setTxnId] = React.useState<string | null>(null);
  const [ticking, setTicking] = React.useState(0);
  const [cardNetwork, setCardNetwork] = React.useState<'RuPay' | 'Visa' | 'Mastercard'>('RuPay');
  const [error, setError] = React.useState('');
  const captured = React.useRef(false);
  const queryClient = useQueryClient();

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

  // Handing the captured payment back exactly once, however many polls land.
  React.useEffect(() => {
    if (attempt?.status === 'Success' && !captured.current) {
      captured.current = true;
      onCaptured(attempt);
    }
  }, [attempt, onCaptured]);

  const initiate = useMutation({
    mutationFn: () =>
      paymentGatewayApi.initiate({
        invoiceId,
        amount: Number(amount),
        method,
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

  const cancel = useMutation({
    mutationFn: () => paymentGatewayApi.cancel(txnId!),
    onSuccess: (res) => queryClient.setQueryData(['payment-attempt', res.txnId], res),
  });

  const retry = () => {
    setTxnId(null);
    captured.current = false;
    setError('');
  };

  const status = attempt?.status;
  const live = !!attempt?.pending;
  const settled = !!attempt && !attempt.pending;
  const won = status === 'Success';

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= dueAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Collect payment</h2>
            <p className="truncate text-[11px] text-slate-500">
              {patientName ? `${patientName} · ` : ''}
              {invoiceNumber} · {money(dueAmount)} due
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Setting the attempt up                                            */}
        {/* ---------------------------------------------------------------- */}
        {!txnId && (
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Method</label>
              <div className="grid grid-cols-2 gap-2">
                {([
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
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-900">{option.label}</span>
                        <span className="block text-[10px] text-slate-500">{option.hint}</span>
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
                max={dueAmount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
              {!amountValid && amount !== '' && (
                <p className="mt-1 text-[10px] font-medium text-rose-600">
                  Enter an amount between ₹1 and {money(dueAmount)}.
                </p>
              )}
            </div>

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
                <p className="mt-1 text-[10px] text-slate-400">
                  With an id, a collect request goes to their app. Without one, they scan the QR.
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!amountValid || initiate.isPending}
                isLoading={initiate.isPending}
                onClick={() => initiate.mutate()}
              >
                {method === 'UPI' ? 'Request' : 'Send to terminal'} {amountValid ? money(amountNum) : ''}
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
                <p className="font-mono text-[11px] text-slate-500">{attempt.payeeVpa}</p>
                <p className="text-[10px] text-slate-400">Any UPI app — GPay, PhonePe, Paytm, BHIM</p>
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
              <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                <FlaskConical className="h-3 w-3" />
                Simulator — the patient's side
              </p>
              <p className="mb-2.5 text-[10px] leading-relaxed text-amber-800">
                Standing in for the patient's phone and the card terminal. With a live gateway the outcome arrives from
                the bank and this panel is gone.
              </p>

              {attempt.method === 'Card' && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-amber-800">Card</span>
                  <select
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value as typeof cardNetwork)}
                    className="h-7 rounded-lg border border-amber-300 bg-white px-2 text-[11px]"
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
        {settled && attempt && (
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
                {won ? `${money(attempt.amount)} received` : `Payment ${status?.toLowerCase()}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {won
                  ? `Paid by ${attempt.method === 'UPI' ? 'UPI' : `${attempt.cardNetwork} card`}`
                  : attempt.failureReason || 'The attempt did not go through.'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <Reference label="Reference" value={attempt.txnId} />
              {won && attempt.method === 'UPI' && <Reference label="UTR" value={attempt.utr} />}
              {won && attempt.method === 'Card' && (
                <>
                  <Reference label="Card" value={attempt.cardLast4 ? `•••• ${attempt.cardLast4}` : ''} />
                  <Reference label="Approval code" value={attempt.authCode} />
                  <Reference label="RRN" value={attempt.rrn} />
                </>
              )}
              {won && <Reference label="Receipt" value={attempt.receiptNumber} />}
            </div>

            {won && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
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
