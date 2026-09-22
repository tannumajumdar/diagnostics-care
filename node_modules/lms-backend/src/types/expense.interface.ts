import { Document, Types } from 'mongoose';
import { type DisbursementMethod } from '../constants/payment-methods';

/**
 * Who the money is going to. The centre pays an ambulance for a pickup far
 * more often than it buys a centrifuge, so the ambulance case is a first-class
 * payee type rather than a free-text category.
 */
export const PAYEE_TYPES = [
  'Ambulance',
  'Doctor Referral',
  'Collection Agent',
  'Courier',
  'Staff Advance',
  'Vendor / Supplier',
  'Reagents & Consumables',
  'Equipment & Maintenance',
  'Rent & Utilities',
  'Other',
] as const;

export type PayeeType = (typeof PAYEE_TYPES)[number];

export const PAYOUT_STATUSES = ['Pending', 'Paid', 'Rejected'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** A payout goes out the same ways a refund does. */
export type PayoutMethod = DisbursementMethod;

export interface IExpenseDocument extends Document {
  expenseId: string;
  payeeType: PayeeType;
  payeeName: string;
  payeeContact?: string;
  /** Mirrors payeeType; retained so older expense records keep reading back. */
  category: string;
  description: string;
  amount: number;
  paymentMethod: PayoutMethod;
  referenceNo?: string;
  expenseDate: Date;
  status: PayoutStatus;
  /** Set when a payout above the petty-cash limit was filed by non-admin staff. */
  needsApproval: boolean;
  patient?: Types.ObjectId;
  invoice?: Types.ObjectId;
  doctor?: Types.ObjectId;
  recordedBy: {
    userId: string;
    name: string;
    role?: string;
  };
  approvedBy?: {
    userId: string;
    name: string;
    role?: string;
    at?: Date;
  };
  rejectionReason?: string;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
