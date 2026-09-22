import { Document, Schema } from 'mongoose';

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
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Online' | 'Credit';
  barcode: string;
  createdBy: {
    userId: Schema.Types.ObjectId;
    name: string;
  };
}

