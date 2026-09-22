import { Banknote, Smartphone, CreditCard, Landmark, FileText, Globe, Clock, type LucideIcon } from 'lucide-react';
import { SERIES } from './charts';

/**
 * Mirrors backend/src/constants/payment-methods.ts.
 *
 * Every screen that asks "how did they pay?" used to write its own `<option>`
 * list, and the five of them had drifted apart - the desk could take a payment
 * by a method the refund screen would not offer back, and two screens called
 * the same method different things. One list here, so the counter, the invoice,
 * the refund and the payout all speak of money the same way.
 */
export interface PaymentMethodOption {
  /** The value stored on the record - must match the backend enum exactly. */
  value: string;
  /** What the desk reads. */
  label: string;
  icon: LucideIcon;
  /** One line of help where the name alone is not obvious. */
  hint?: string;
}

export const COLLECTION_METHODS: PaymentMethodOption[] = [
  { value: 'Cash', label: 'Cash', icon: Banknote, hint: 'Notes into the drawer' },
  { value: 'UPI', label: 'UPI', icon: Smartphone, hint: 'GPay, PhonePe, Paytm, BHIM' },
  { value: 'Card', label: 'Card', icon: CreditCard, hint: 'Credit or debit, on the machine' },
  { value: 'Bank Transfer', label: 'Bank Transfer', icon: Landmark, hint: 'NEFT, IMPS or RTGS' },
  { value: 'Cheque', label: 'Cheque', icon: FileText, hint: 'Cleared on deposit' },
  { value: 'Online', label: 'Online', icon: Globe, hint: 'Paid through a payment gateway' },
  { value: 'Credit', label: 'Credit (pay later)', icon: Clock, hint: 'Billed now, collected afterwards' },
];

/**
 * Money going back out. There is no refunding somebody by promising to pay
 * them later, so credit is not on this list.
 */
export const DISBURSEMENT_METHODS: PaymentMethodOption[] = COLLECTION_METHODS.filter((m) => m.value !== 'Credit');

const byValue = new Map(COLLECTION_METHODS.map((m) => [m.value, m]));

/** The label for a stored value, falling back to the value itself. */
export const methodLabel = (value?: string | null): string => byValue.get(String(value))?.label ?? value ?? '—';

export const methodIcon = (value?: string | null): LucideIcon | undefined => byValue.get(String(value))?.icon;

/**
 * A method's colour, fixed to its position on the list above.
 *
 * The reports donut used to colour its slices by size, so cash was blue in a
 * month it led and orange in a month UPI overtook it. Colour has to follow the
 * thing, not its rank, or a reader who learned "blue is cash" is being misled
 * by the next month's chart. Anything off the list - the folded "Other"
 * bucket - gets a neutral grey rather than borrowing a method's hue.
 */
const methodIndex = new Map(COLLECTION_METHODS.map((m, i) => [m.value, i]));

export const methodColor = (value?: string | null): string => {
  const index = methodIndex.get(String(value));
  return index === undefined ? '#94a3b8' : SERIES[index % SERIES.length];
};

/** The key a method is totalled into on a collection summary. */
export const METHOD_FIELD: Record<string, string> = {
  Cash: 'cash',
  UPI: 'upi',
  Card: 'card',
  'Bank Transfer': 'bank',
  Cheque: 'cheque',
  Online: 'online',
  Credit: 'credit',
};
