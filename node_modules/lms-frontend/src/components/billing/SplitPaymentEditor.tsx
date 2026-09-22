import React from 'react';
import { Input } from '../ui/input';
import { COLLECTION_METHODS, methodIcon } from '../../config/payment-methods';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

/**
 * A payment taken across more than one method.
 *
 * Patients split the counter all the time - ₹500 in cash and the rest on UPI
 * because the notes in the wallet do not cover the bill. Recorded as a single
 * method it either overstates the drawer or overstates the machine, and the
 * day never reconciles. Each leg is entered here, and each becomes its own
 * receipt on the way to the books.
 *
 * The editor owns the arithmetic the desk would otherwise do in its head:
 * what is still unallocated, and whether the legs add up to what is being
 * collected. It never silently adjusts a figure the receptionist typed.
 */

export interface Tender {
  method: string;
  amount: number | '';
}

/** Credit is a promise to pay, not money taken, so it is never a split leg. */
const SPLITTABLE = COLLECTION_METHODS.filter((m) => m.value !== 'Credit');

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const tenderTotal = (tenders: Tender[]): number =>
  Math.round(tenders.reduce((sum, tender) => sum + (Number(tender.amount) || 0), 0) * 100) / 100;

/** What goes on the wire - empty rows and zero legs are not a payment. */
export const tenderPayload = (tenders: Tender[]) =>
  tenders
    .filter((tender) => Number(tender.amount) > 0)
    .map((tender) => ({ method: tender.method, amount: Number(tender.amount) }));

export interface SplitPaymentEditorProps {
  tenders: Tender[];
  onChange: (tenders: Tender[]) => void;
  /** What is being collected in total - the due, or the bill's net. */
  target: number;
  /** Shown under the rows when the legs do not add up to the target. */
  requireExact?: boolean;
}

export const SplitPaymentEditor: React.FC<SplitPaymentEditorProps> = ({
  tenders,
  onChange,
  target,
  requireExact = false,
}) => {
  const allocated = tenderTotal(tenders);
  const remaining = Math.round((target - allocated) * 100) / 100;

  const update = (index: number, patch: Partial<Tender>) =>
    onChange(tenders.map((tender, i) => (i === index ? { ...tender, ...patch } : tender)));

  const addRow = () => {
    // Opens on a method not already used, so the desk is not made to change a
    // dropdown that defaulted to the row above it.
    const used = new Set(tenders.map((t) => t.method));
    const next = SPLITTABLE.find((m) => !used.has(m.value)) || SPLITTABLE[0];
    onChange([...tenders, { method: next.value, amount: remaining > 0 ? remaining : '' }]);
  };

  const removeRow = (index: number) => onChange(tenders.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {tenders.map((tender, index) => {
        const Icon = methodIcon(tender.method);
        return (
          <div key={index} className="flex items-center gap-2">
            <div className="relative flex-1">
              {Icon && (
                <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              )}
              <select
                value={tender.method}
                onChange={(e) => update(index, { method: e.target.value })}
                className="h-9 w-full rounded-lg border bg-background pl-8 pr-2 text-xs"
              >
                {SPLITTABLE.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              type="number"
              min={0}
              value={tender.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update(index, { amount: e.target.value === '' ? '' : Number(e.target.value) })
              }
              placeholder="0"
              className="h-9 w-28 text-right font-mono font-semibold"
            />

            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={tenders.length === 1}
              aria-label="Remove this payment line"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={addRow}
          disabled={tenders.length >= SPLITTABLE.length}
          className="flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add method
        </button>

        <div className="text-right text-[11px]">
          <span className="text-muted-foreground">Allocated </span>
          <span className="font-mono font-bold">{money(allocated)}</span>
          <span className="text-muted-foreground"> of {money(target)}</span>
        </div>
      </div>

      {/* The desk is told what is left rather than having it quietly applied -
          a leg that was meant to be ₹500 and was typed as ₹50 is a counting
          error, and silently topping it up would hide it. */}
      {remaining !== 0 && (
        <button
          type="button"
          onClick={() => {
            if (!tenders.length) return;
            const last = tenders.length - 1;
            const topped = Math.round(((Number(tenders[last].amount) || 0) + remaining) * 100) / 100;
            update(last, { amount: Math.max(0, topped) });
          }}
          className={`flex w-full items-start gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] transition ${
            remaining > 0
              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {remaining > 0
              ? `${money(remaining)} still unallocated`
              : `${money(Math.abs(remaining))} over the amount being collected`}
            {requireExact ? ' — the lines must add up exactly. ' : ' '}
            <span className="font-semibold underline">Put it on the last line</span>
          </span>
        </button>
      )}
    </div>
  );
};
