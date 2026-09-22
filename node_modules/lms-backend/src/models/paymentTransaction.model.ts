import { Schema, model, Document, Types } from 'mongoose';

/**
 * One attempt at collecting money through a machine - a UPI request or a card
 * on the terminal.
 *
 * This is deliberately a separate record from `Payment`. A Payment is money
 * the centre *has*; a transaction is an attempt that may still be in flight,
 * may be declined, and may be retried. Collapsing the two is how a declined
 * card ends up in the day's takings. A Payment is written only when a
 * transaction reaches Success, and carries that transaction's reference.
 *
 * The provider behind it is a simulator (see paymentGateway.service.ts), but
 * the lifecycle is the real one: the desk initiates, the payer acts on their
 * own device, the desk polls, and the gateway - not the desk - decides the
 * outcome.
 */

export type TransactionMethod = 'UPI' | 'Card';

export const TRANSACTION_STATUSES = ['Pending', 'Success', 'Failed', 'Expired', 'Cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Once a transaction reaches one of these, nothing moves it again. */
export const TERMINAL_STATUSES: TransactionStatus[] = ['Success', 'Failed', 'Expired', 'Cancelled'];

export interface IPaymentTransaction extends Document {
  txnId: string;
  invoice: Types.ObjectId;
  patient: Types.ObjectId;
  amount: number;
  method: TransactionMethod;
  status: TransactionStatus;

  /** The payer's UPI id when the request was sent to one; blank for a QR. */
  vpa: string;
  /** The `upi://pay?...` string the QR encodes. */
  upiIntent: string;
  /** The bank reference a successful UPI payment settles with. */
  utr: string;

  cardLast4: string;
  cardNetwork: string;
  /** The issuer's approval code, printed on the charge slip. */
  authCode: string;
  /** Retrieval reference number - the card equivalent of a UTR. */
  rrn: string;

  /**
   * A secret for the payer's side of the flow. Transaction ids run in
   * sequence, so `PGT-2026-000001` tells anyone what the next one is called -
   * without this, guessing an id would be enough to mark somebody else's
   * collection as paid. A real provider solves the same problem with a signed
   * webhook; this is the stand-in for that signature.
   */
  payerToken: string;
  failureReason: string;
  expiresAt: Date;
  completedAt?: Date;
  /** The Payment this became, once it succeeded. */
  payment?: Types.ObjectId;
  initiatedBy: { userId: Types.ObjectId; name: string };
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    txnId: { type: String, required: true, unique: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['UPI', 'Card'], required: true },
    status: { type: String, enum: TRANSACTION_STATUSES, default: 'Pending', index: true },

    vpa: { type: String, default: '', trim: true },
    upiIntent: { type: String, default: '' },
    utr: { type: String, default: '' },

    cardLast4: { type: String, default: '' },
    cardNetwork: { type: String, default: '' },
    authCode: { type: String, default: '' },
    rrn: { type: String, default: '' },

    payerToken: { type: String, required: true, select: false },
    failureReason: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    initiatedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
    },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ createdAt: -1 });

export const PaymentTransaction = model<IPaymentTransaction>('PaymentTransaction', paymentTransactionSchema);
