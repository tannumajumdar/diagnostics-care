/**
 * How money moves at the centre.
 *
 * This list used to be written out by hand in seven places - the payment,
 * refund and expense models, three validators and two aggregations - and they
 * had drifted apart: the desk could take a payment by a method the refund
 * screen could not give back, and the daily collection figure silently dropped
 * any method its if-else chain had not been taught about. One list, consumed
 * everywhere, so a method added here reaches every screen at once.
 */

/** Everything the centre can take money by. */
export const COLLECTION_METHODS = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Cheque',
  'Online',
  // Not money in the drawer - the patient is billed and pays later. It is a
  // method at the counter because that is the choice the desk makes there.
  'Credit',
] as const;

export type CollectionMethod = (typeof COLLECTION_METHODS)[number];

/**
 * How money goes back out - a refund to a patient, or a payout to a vendor.
 * "Credit" has no meaning here: there is no such thing as refunding someone
 * by promising to pay them later.
 */
export const DISBURSEMENT_METHODS = COLLECTION_METHODS.filter((m) => m !== 'Credit') as Exclude<
  CollectionMethod,
  'Credit'
>[];

export type DisbursementMethod = (typeof DISBURSEMENT_METHODS)[number];

/**
 * The field each method is totalled into on a collection summary. Keeping the
 * mapping here means a new method cannot be added without deciding where it
 * lands in the books.
 */
export const METHOD_FIELD: Record<CollectionMethod, string> = {
  Cash: 'cash',
  UPI: 'upi',
  Card: 'card',
  'Bank Transfer': 'bank',
  Cheque: 'cheque',
  Online: 'online',
  Credit: 'credit',
};

/** The keys a breakdown object carries, in the order a summary reads them. */
export const METHOD_FIELDS = COLLECTION_METHODS.map((m) => METHOD_FIELD[m]);

/** Zod-friendly tuple form, since `z.enum` will not take a readonly array. */
export const COLLECTION_METHOD_VALUES = [...COLLECTION_METHODS] as [string, ...string[]];
export const DISBURSEMENT_METHOD_VALUES = [...DISBURSEMENT_METHODS] as [string, ...string[]];
