/**
 * The lifecycle of a collection attempt through a machine - a UPI request or
 * a card on the terminal. See services/paymentGateway.service.ts.
 */
export type TransactionMethod = 'UPI' | 'Card';

export const TRANSACTION_STATUSES = ['Pending', 'Success', 'Failed', 'Expired', 'Cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Once a transaction reaches one of these, nothing moves it again. */
export const TERMINAL_STATUSES: TransactionStatus[] = ['Success', 'Failed', 'Expired', 'Cancelled'];
