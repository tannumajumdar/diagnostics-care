import { Document, Schema } from 'mongoose';
import { CollectionMethod } from '../constants/payment-methods';

/** How much of a bill came in by one method. */
export interface IPaymentSplit {
  method: CollectionMethod;
  amount: number;
}

export interface IInvoiceItem {
  test: Schema.Types.ObjectId;
  testCode: string;
  testName: string;
  department: Schema.Types.ObjectId;
  departmentName: string;
  rate: number;
  /** What the desk knocked off this line before any bill-wide discount. */
  lineDiscountAmount?: number;
  discountAmount?: number;
  netAmount: number;
  processingMode?: 'In-house' | 'Outsource';
  outsourceLab?: string;
  referralRate?: number;
  packageId?: Schema.Types.ObjectId;
  packageName?: string;
  /**
   * Set when the patient decided against this test. The line stays on the
   * bill - struck through rather than deleted, because the bill was printed
   * with it on and the history has to keep reading the way it was handed over.
   */
  cancelled?: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  /** What actually went back to the patient for this line. */
  refundedAmount?: number;
  /** What the centre kept of it, per the refund policy in force that day. */
  retainedAmount?: number;
  cancelledBy?: {
    userId: string;
    name: string;
    role: string;
  };
}

export interface IInvoiceDocument extends Document {
  invoiceNumber: string;
  patient: Schema.Types.ObjectId;
  uhid: string;
  /** The visit's enquiry number, e.g. ENQ-2026-000045. */
  enquiryNo?: string;
  referringDoctor?: Schema.Types.ObjectId;
  organization?: Schema.Types.ObjectId;
  referringDoctorName?: string;
  chiefComplaint?: string;
  clinicalNotes?: string;
  priority?: 'Routine' | 'Urgent';
  items: IInvoiceItem[];
  subtotal: number;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  discountReason?: string;
  /** The doctor the concession came through - not necessarily the referrer. */
  discountDoctor?: Schema.Types.ObjectId;
  discountDoctorName?: string;
  netAmount: number;
  /** What the referring doctor's own copy of this bill comes to. */
  referralTotal?: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid' | 'Credit';
  /** The tender the bill is filed under - the largest one when it was split. */
  paymentMethod: CollectionMethod;
  /** What came in by each method. One entry for a bill paid one way. */
  paymentBreakdown: IPaymentSplit[];
  barcode: string;
  createdBy: {
    userId: Schema.Types.ObjectId;
    name: string;
  };
  /** Every revision the bill has been through since it was raised. */
  revisions?: Array<{
    at: Date;
    by: { userId?: string; name?: string; role?: string };
    summary: string;
    testsAdded: string[];
    netBefore: number;
    netAfter: number;
  }>;
}

