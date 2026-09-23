import React from 'react';
import { Input } from '../ui/input';
import { COLLECTION_METHODS, methodIcon, methodLabel } from '../../config/payment-methods';
import { Check, AlertCircle } from 'lucide-react';

/**
 * A payment taken across more than one method.
 *
 * Patients split the counter all the time - ₹500 in cash and the rest on UPI
 * because the notes in the wallet do not cover the bill. Recorded as a single
 * method it either overstates the drawer or overstates the machine, and the
 * day never reconciles. Each leg is entered here, and each becomes its own
 * receipt on the way to the books.
 *
 * A split is two boxes, never three. Cash is one of them - nobody splits a
 * bill without notes crossing the counter - and the other is whatever the
 * rest was paid on: UPI nine times in ten, so that is the box the editor
 * opens with. Card, a cheque or a transfer replaces UPI rather than joining
 * it, because a patient paying the remainder on the machine is not also
 * paying it on an app, and a third empty box is a figure waiting to be typed
 * into it by mistake. The receptionist picks the second tender from the row
 * of chips and types two amounts.
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

/** The box every split has, and the one the second box starts as. */
export const CASH_METHOD = 'Cash';
export const DEFAULT_SECOND_METHOD = 'UPI';

/** The two boxes a split always opens with, in the order the counter uses. */
export const DEFAULT_SPLIT_METHODS = [CASH_METHOD, DEFAULT_SECOND_METHOD];

/** The tender beside cash: whatever non-cash box is on the split, else UPI. */
const secondMethodOf = (tenders: Tender[]): string =>
  tenders.find((t) => t.method !== CASH_METHOD && SPLITTABLE.some((m) => m.value === t.method))?.method ??
  DEFAULT_SECOND_METHOD;

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const tenderTotal = (tenders: Tender[]): number =>
  Math.round(tenders.reduce((sum, tender) => sum + (Number(tender.amount) || 0), 0) * 100) / 100;

/** What goes on the wire - empty rows and zero legs are not a payment. */
export const tenderPayload = (tenders: Tender[]) =>
  tenders
    .filter((tender) => Number(tender.amount) > 0)
    .map((tender) => ({ method: tender.method, amount: Number(tender.amount) }));

/**
 * The rows a split opens on, carrying whatever amount was already typed under
 * the method it was typed against. Switching from one method to a split never
 * drops a figure the desk entered: a bill half-typed as ₹400 on Card opens as
 * Cash and Card with the ₹400 where it was put, not as Cash and UPI with the
 * figure orphaned on a third line.
 */
export const splitSeed = (method?: string | null, amount: number | '' = ''): Tender[] => {
  const holder = SPLITTABLE.some((m) => m.value === method) ? String(method) : CASH_METHOD;
  return holder === CASH_METHOD
    ? [
        { method: CASH_METHOD, amount },
        { method: DEFAULT_SECOND_METHOD, amount: '' },
      ]
    : [
        { method: CASH_METHOD, amount: '' },
        { method: holder, amount },
      ];
};

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

  /**
   * Two boxes, in the order the counter uses them: cash, then whatever the
   * rest was taken on. Neither box moves under the cursor while an amount is
   * being typed into it, because picking a different second tender renames
   * that box rather than adding one.
   */
  const second = secondMethodOf(tenders);
  const rows = [CASH_METHOD, second];

  const amountOf = (method: string): number | '' => {
    const tender = tenders.find((t) => t.method === method);
    return tender ? tender.amount : '';
  };

  const setAmount = (method: string, amount: number | '') => {
    const exists = tenders.some((t) => t.method === method);
    onChange(
      exists
        ? tenders.map((tender) => (tender.method === method ? { ...tender, amount } : tender))
        : [...tenders, { method, amount }]
    );
  };

  /**
   * The second tender changes from UPI to Card, a cheque or a transfer. The
   * figure already in that box stays in it - the desk is saying the same
   * money came in another way, not that it did not come in - and the split is
   * rebuilt as the two rows, so a tender left over from an earlier choice
   * cannot ride along unseen into the payload.
   */
  const chooseSecond = (method: string) => {
    if (method === second) return;
    onChange([
      { method: CASH_METHOD, amount: amountOf(CASH_METHOD) },
      { method, amount: amountOf(second) },
    ]);
  };

  /**
   * The remainder goes on the first box still empty - on a plain cash-and-UPI
   * split that is the one the desk has not typed into - and on the last box
   * when every one of them already holds a figure.
   */
  const topUp = () => {
    const box = rows.find((method) => !Number(amountOf(method))) ?? rows[rows.length - 1];
    if (!box) return;
    setAmount(box, Math.max(0, Math.round(((Number(amountOf(box)) || 0) + remaining) * 100) / 100));
  };

  /** Everything that can sit beside cash - the one in use included. */
  const alternatives = SPLITTABLE.filter((m) => m.value !== CASH_METHOD);

  return (
    <div className="space-y-2">
      {rows.map((method) => {
        const Icon = methodIcon(method);
        return (
          <div key={method} className="flex items-center gap-2">
            {/* The method is a label, not a control - it is a fact about the
                box, and there is nothing here for the desk to decide. */}
            <div className="flex h-9 w-32 shrink-0 items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 text-xs font-semibold text-slate-700">
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{methodLabel(method)}</span>
            </div>

            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                min={0}
                value={amountOf(method)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAmount(method, e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="0"
                aria-label={`Amount taken by ${methodLabel(method)}`}
                className="h-9 w-full pl-6 text-right font-mono font-semibold"
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        {/* The second tender, named on the chips rather than buried in a
            dropdown - the desk can see what the choices are without opening
            anything, and which one it is looking at. Picking one renames the
            second box; there is never a third. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">Rest paid by</span>
          {alternatives.map((m) => {
            const active = m.value === second;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => chooseSecond(m.value)}
                aria-pressed={active}
                title={m.hint}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-semibold transition ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-dashed text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {active && <Check className="h-3 w-3" />} {m.label}
              </button>
            );
          })}
        </div>

        <div className="text-right text-[12px]">
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
          onClick={topUp}
          className={`flex w-full items-start gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${
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
            <span className="font-semibold underline">Put it on the empty box</span>
          </span>
        </button>
      )}
    </div>
  );
};
