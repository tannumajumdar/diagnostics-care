import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { refundPolicyApi, CancellationQuote } from '../../api/refundPolicy.api';
import { billingApi } from '../../api/billing.api';
import { Invoice } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '../../context/ToastContext';
import { DISBURSEMENT_METHODS } from '../../config/payment-methods';
import { asList } from '../../utils/api-list';
import { X, Undo2, AlertTriangle, Info, ShieldAlert, Search, ChevronDown } from 'lucide-react';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const billLabel = (inv: Invoice) =>
  `${inv.invoiceNumber} - ${inv.patient?.patientName || 'N/A'} (paid ${money(inv.paidAmount)})`;

/**
 * Bill picker the counter can type into. Recent bills show straight away; a
 * search goes to the server (bill no., UHID, name, mobile) so a bill older
 * than the recent list can still be found.
 */
const BillSearchSelect: React.FC<{
  recent: Invoice[];
  value: string;
  /** What the field shows for the chosen bill. */
  label: string;
  onChange: (inv: Invoice) => void;
}> = ({ recent, value, label, onChange }) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['invoices-refund-search', debounced],
    queryFn: () => billingApi.getAllInvoices({ search: debounced, limit: 20 }),
    enabled: open && debounced.length > 0,
  });

  const options = debounced ? asList<Invoice>(data, 'invoices') : recent;

  const select = (inv: Invoice) => {
    onChange(inv);
    setOpen(false);
    setTerm('');
  };

  return (
    <div ref={boxRef} className="relative">
      {/* The field itself is the search box: typing searches, and once a bill
          is picked its label sits in the field until the user types again. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={open ? term : label}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={label || 'Search bill no., UHID, patient name or mobile'}
          className="pl-8 pr-8"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto py-1">
            {isFetching && debounced ? (
              <li className="px-3 py-2 text-muted-foreground">Searching...</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">No bills found</li>
            ) : (
              options.map((inv) => (
                <li key={inv._id}>
                  <button
                    type="button"
                    onClick={() => select(inv)}
                    className={`w-full px-3 py-2 text-left hover:bg-accent ${
                      inv._id === value ? 'bg-accent font-semibold' : ''
                    }`}
                  >
                    <span className="font-mono font-semibold text-blue-600">{inv.invoiceNumber}</span>
                    {' - '}
                    {inv.patient?.patientName || 'N/A'}
                    <span className="text-muted-foreground"> (paid {money(inv.paidAmount)})</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Recent bills, for picking the one the patient is asking about. */
  invoices: Invoice[];
  /** Whether this user may hand back more than the policy allows. */
  canOverride: boolean;
  onDone: () => void;
  /**
   * Opened from a row in the test list: the bill is already chosen and that
   * test ticked, so the counter only confirms.
   */
  preset?: { invoiceId: string; label: string; itemIndex?: number } | null;
}

/**
 * The patient does not want a test after all.
 *
 * Every line is priced against the centre's refund policy before anything is
 * handed back - the stage read off the patient's own sample, the share off the
 * policy the Admin wrote. The counter picks the tests and confirms; it does
 * not decide what they are worth.
 */
export const CancelTestRefundModal: React.FC<Props> = ({
  isOpen,
  onClose,
  invoices,
  canOverride,
  onDone,
  preset,
}) => {
  const { showToast } = useToast();

  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceLabel, setInvoiceLabel] = useState('');
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<string>('Cash');
  const [remarks, setRemarks] = useState('');
  const [useOverride, setUseOverride] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Cleared on close so reopening on the same bill still fetches its quote.
    if (!isOpen) {
      setInvoiceId('');
      return;
    }
    setInvoiceId(preset?.invoiceId || '');
    setInvoiceLabel(preset?.label || '');
    setQuote(null);
    setPicked([]);
    setReason('');
    setRemarks('');
    setMethod('Cash');
    setUseOverride(false);
    setOverrideAmount(0);
    setOverrideReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!invoiceId) {
      setQuote(null);
      setPicked([]);
      return;
    }
    let cancelled = false;
    const fetchQuote = async () => {
      try {
        setLoadingQuote(true);
        const data: CancellationQuote = await refundPolicyApi.getQuote(invoiceId);
        if (cancelled) return;
        setQuote(data);
        // Tick the test the row was opened from, if it can still be cancelled.
        const presetLine =
          preset?.invoiceId === invoiceId && preset.itemIndex !== undefined
            ? data.items.find((item) => item.index === preset.itemIndex && item.eligible)
            : undefined;
        setPicked(presetLine ? [presetLine.index] : []);
      } catch (error: any) {
        if (!cancelled) showToast(error?.message || 'Could not read this bill', 'error');
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    };
    fetchQuote();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const pickedLines = useMemo(
    () => (quote?.items || []).filter((item) => picked.includes(item.index)),
    [quote, picked]
  );

  const policyTotal = pickedLines.reduce((sum, line) => sum + line.refundable, 0);
  const billedTotal = pickedLines.reduce((sum, line) => sum + line.lineValue, 0);
  const creditTotal = useOverride ? Number(overrideAmount) || 0 : policyTotal;
  // Money only comes back out of money that came in - the rest just stops
  // being owed, and the counter needs to see that split before confirming.
  const cashBack = Math.min(creditTotal, quote?.invoice.paidAmount || 0);
  const dueWaived = Math.max(0, creditTotal - cashBack);

  if (!isOpen) return null;

  const toggle = (index: number) =>
    setPicked((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (picked.length === 0) {
      showToast('Pick at least one test to cancel', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const result = await refundPolicyApi.cancelTests({
        invoiceId,
        itemIndexes: picked,
        reason: reason.trim(),
        paymentMethod: method,
        remarks: remarks.trim() || undefined,
        ...(useOverride
          ? { overrideAmount: Number(overrideAmount) || 0, overrideReason: overrideReason.trim() }
          : {}),
      });

      showToast(
        result.cashRefund > 0
          ? `${money(result.cashRefund)} refunded and ${picked.length} test(s) cancelled`
          : `${picked.length} test(s) cancelled - ${money(result.dueWaived)} came off what the patient owes`,
        'success'
      );
      onDone();
      onClose();
    } catch (error: any) {
      showToast(error?.message || 'Could not cancel these tests', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Undo2 className="h-4 w-4 text-amber-600" />
            Cancel a Test &amp; Refund
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold">The patient&rsquo;s bill *</label>
            <BillSearchSelect
              recent={invoices}
              value={invoiceId}
              label={invoiceLabel}
              onChange={(inv) => {
                setInvoiceId(inv._id);
                setInvoiceLabel(billLabel(inv));
              }}
            />
          </div>

          {loadingQuote && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
              Pricing this bill against the refund policy...
            </p>
          )}

          {quote && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <Badge variant="purple">{quote.invoice.invoiceNumber}</Badge>
                <span className="font-semibold">{quote.invoice.patient?.patientName}</span>
                <span className="text-muted-foreground">
                  Billed {money(quote.invoice.netAmount)} · Paid {money(quote.invoice.paidAmount)} · Due{' '}
                  {money(quote.invoice.dueAmount)}
                </span>
                <Badge variant={quote.windowOpen ? 'success' : 'destructive'}>
                  {quote.daysSinceBill} day(s) old
                </Badge>
              </div>

              {quote.policy.policyNote && (
                <p className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] text-violet-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{quote.policy.policyNote}</span>
                </p>
              )}

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2"></th>
                      <th className="p-2">Test</th>
                      <th className="p-2">Where the work got to</th>
                      <th className="p-2">Billed</th>
                      <th className="p-2">Comes back</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quote.items.map((item) => (
                      <tr
                        key={item.index}
                        className={`align-top ${item.cancelled ? 'opacity-50' : 'hover:bg-muted/30'}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={picked.includes(item.index)}
                            disabled={item.cancelled || (!item.eligible && !useOverride)}
                            onChange={() => toggle(item.index)}
                          />
                        </td>
                        <td className="p-2">
                          <div className={`font-semibold ${item.cancelled ? 'line-through' : ''}`}>
                            {item.testName}
                          </div>
                          <div className="text-muted-foreground">
                            {item.testCode}
                            {item.packageName ? ` · ${item.packageName}` : ''}
                          </div>
                        </td>
                        <td className="p-2">
                          <div>{item.stageLabel}</div>
                          <div className="text-muted-foreground">
                            {item.sampleId ? `${item.sampleId} · ${item.sampleStatus}` : item.sampleStatus}
                          </div>
                          {item.blockers.length > 0 && (
                            <div className="mt-0.5 font-semibold text-red-600">{item.blockers.join('; ')}</div>
                          )}
                        </td>
                        <td className="p-2 font-mono">{money(item.lineValue)}</td>
                        <td className="p-2">
                          {item.cancelled ? (
                            <span className="text-muted-foreground">
                              cancelled · {money(item.refundedAmount)} refunded
                            </span>
                          ) : item.eligible ? (
                            <>
                              <span className="font-mono font-bold text-emerald-600">
                                {money(item.refundable)}
                              </span>
                              <div className="text-muted-foreground">{item.refundPercent}% of the line</div>
                            </>
                          ) : (
                            <span className="font-semibold text-red-600">Not refundable</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {picked.length > 0 && (
                <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex justify-between">
                    <span>{picked.length} test(s) billed at</span>
                    <span className="font-mono">{money(billedTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Cash back to the patient</span>
                    <span className="font-mono">{money(cashBack)}</span>
                  </div>
                  {dueWaived > 0 && (
                    <div className="flex justify-between">
                      <span>Comes off what they still owe</span>
                      <span className="font-mono">{money(dueWaived)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Kept by the centre for work already done</span>
                    <span className="font-mono">{money(Math.max(0, billedTotal - creditTotal))}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">Why is it being cancelled? *</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Patient no longer wants this test"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Refund paid out by</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                  >
                    {DISBURSEMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold">Remarks</label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Anything the registry should carry"
                />
              </div>

              {canOverride && quote.policy.allowAdminOverride && (
                <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <input
                      id="policy-override"
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5"
                      checked={useOverride}
                      onChange={(e) => setUseOverride(e.target.checked)}
                    />
                    <label htmlFor="policy-override" className="cursor-pointer text-red-900">
                      <span className="flex items-center gap-1 font-semibold">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Override the policy for this refund
                      </span>
                      <span className="block text-[11px]">
                        The amount below is handed back instead of the {money(policyTotal)} the policy
                        allows. The reason is written onto the refund record.
                      </span>
                    </label>
                  </div>

                  {useOverride && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        type="number"
                        min={0}
                        max={billedTotal}
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(Number(e.target.value))}
                        placeholder="Amount to refund"
                      />
                      <Input
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Reason for the override *"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {!quote.policy.enabled && (
                <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Refund on cancellation is switched off for this centre. An Admin can turn it on from the
                    Refund Policy screen.
                  </span>
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={!quote || picked.length === 0 || !quote.policy.enabled}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Cancel {picked.length || ''} test{picked.length === 1 ? '' : 's'} &amp; refund {money(cashBack)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
