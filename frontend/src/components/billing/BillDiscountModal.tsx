import React, { useEffect, useState } from 'react';
import { Doctor } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Percent, Stethoscope, AlertTriangle, Trash2 } from 'lucide-react';

const money = (value: unknown) => `₹${(Number(value) || 0).toLocaleString('en-IN')}`;

/** The concession on a bill, and whose word it was given on. */
export interface BillDiscountDraft {
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  discountReason: string;
  discountDoctorId: string;
  discountDoctorName: string;
}

export const EMPTY_BILL_DISCOUNT: BillDiscountDraft = {
  discountType: 'Fixed',
  discountValue: 0,
  discountReason: '',
  discountDoctorId: '',
  discountDoctorName: '',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Handed the finished concession - the caller decides what to do with it. */
  onApply: (discount: BillDiscountDraft) => void;
  /** What is on the bill now, so reopening edits rather than starts again. */
  value: BillDiscountDraft;
  doctors: Doctor[];
  subtotal: number;
  lineDiscountTotal: number;
  /** Rate-card total the 20% staff limit is measured against. */
  catalogueTotal: number;
}

/**
 * The bill-wide concession, asked for in a window of its own.
 *
 * Most bills at the counter carry no discount at all, and the four fields a
 * discount needs - how much, on whose word, and why - crowded the payment
 * panel on every one of them. Behind a button the panel stays short, and the
 * desk that does need a concession gets the whole thing on one screen with
 * the net payable moving underneath as it types, instead of reading it back
 * off the panel afterwards.
 */
export const BillDiscountModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  value,
  doctors,
  subtotal,
  lineDiscountTotal,
  catalogueTotal,
}) => {
  const [draft, setDraft] = useState<BillDiscountDraft>(value);

  // The window is a draft: what is typed only reaches the bill on Apply, so
  // a desk that opens it to look and changes its mind leaves nothing behind.
  useEffect(() => {
    if (isOpen) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (patch: Partial<BillDiscountDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  // Same order as the bill itself: line discounts come off first, and the
  // bill-wide one works on what is left.
  const discountBase = Math.max(0, subtotal - lineDiscountTotal);
  const billDiscount =
    draft.discountType === 'Percentage'
      ? (discountBase * Math.min(100, Math.max(0, draft.discountValue))) / 100
      : Math.min(discountBase, Math.max(0, draft.discountValue));
  const netAmount = Math.max(0, discountBase - billDiscount);
  const concessionPercent =
    catalogueTotal > 0 ? ((catalogueTotal - netAmount) / catalogueTotal) * 100 : 0;

  const apply = () => {
    onApply({
      ...draft,
      discountValue: Math.max(0, Number(draft.discountValue) || 0),
      discountReason: draft.discountReason.trim(),
      discountDoctorName: draft.discountDoctorId ? '' : draft.discountDoctorName.trim(),
    });
    onClose();
  };

  const remove = () => {
    onApply(EMPTY_BILL_DISCOUNT);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      {/* The window opens over the new-visit form, so Enter inside it has to
          mean "apply this discount" - left alone it would submit the form
          behind and register the visit on a half-typed concession. */}
      <div
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            apply();
          }
        }}
      >
        <div className="flex items-start justify-between border-b pb-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Percent className="h-4 w-4 text-emerald-600" />
              Discount on the whole bill
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Comes off {money(discountBase)} - what is left after the test-level discounts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold">How much</label>
            <div className="flex gap-2">
              <select
                value={draft.discountType}
                onChange={(e) => set({ discountType: e.target.value as 'Percentage' | 'Fixed' })}
                className="h-9 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="Fixed">Fixed (₹)</option>
                <option value="Percentage">Percent (%)</option>
              </select>
              <Input
                autoFocus
                type="number"
                min={0}
                max={draft.discountType === 'Percentage' ? 100 : undefined}
                value={draft.discountValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set({ discountValue: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-9"
              />
            </div>
            {draft.discountType === 'Percentage' && draft.discountValue > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {draft.discountValue}% of {money(discountBase)} is {money(billDiscount)}.
              </p>
            )}
          </div>

          {/* Discount given through – always shown, both fields are optional. */}
          <div>
            <label className="mb-1 flex items-center gap-1 font-semibold">
              <Stethoscope className="h-3 w-3 text-violet-600" />
              Discount given through
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              value={draft.discountDoctorId}
              onChange={(e) =>
                set({
                  discountDoctorId: e.target.value,
                  discountDoctorName: e.target.value ? '' : draft.discountDoctorName,
                })
              }
              className="h-9 w-full rounded-lg border bg-background px-2 text-xs"
            >
              <option value="">Centre&rsquo;s own concession / not through a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.doctorName}
                  {doctor.specialty ? ` · ${doctor.specialty}` : ''}
                </option>
              ))}
            </select>
            {!draft.discountDoctorId && (
              <Input
                value={draft.discountDoctorName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set({ discountDoctorName: e.target.value })
                }
                placeholder="Or type a doctor who is not on the panel"
                className="mt-1 h-9"
              />
            )}
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 font-semibold">
              Reason
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={draft.discountReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                set({ discountReason: e.target.value })
              }
              placeholder="e.g. Staff family, camp rate"
              className="h-9"
            />
          </div>

          {/* What it comes to, moving as the desk types. */}
          <div className="space-y-1 rounded-xl border bg-muted/30 p-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Test-level discounts</span>
                <span className="font-mono">- {money(lineDiscountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-700">
              <span>Bill discount</span>
              <span className="font-mono">- {money(billDiscount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-sm font-bold text-blue-600">
              <span>Net payable</span>
              <span className="font-mono">{money(netAmount)}</span>
            </div>
          </div>

          {/* The server refuses this above the staff limit, so say it here
              rather than after the desk has taken the patient's money. */}
          {concessionPercent > 20 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This bill is {concessionPercent.toFixed(1)}% off the rate card - above the 20% staff
                limit, an Admin has to raise it.
              </span>
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {value.discountValue > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={remove}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={apply}>
                Apply discount
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
