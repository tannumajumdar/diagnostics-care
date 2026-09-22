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
  discountAmount?: number;
  netAmount: number;
  processingMode?: 'In-house' | 'Outsource';
  outsourceLab?: string;
  referralRate?: number;
  packageId?: Schema.Types.ObjectId;
  packageName?: string;
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
}

