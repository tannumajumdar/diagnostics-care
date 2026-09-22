import { Schema, model } from 'mongoose';
import { IInvoiceDocument } from '../types/invoice.interface';
import { COLLECTION_METHODS } from '../constants/payment-methods';

/**
 * How much of a bill came in by each method.
 *
 * A patient paying half in cash and half by UPI is two tenders against one
 * bill, and each still has to reach the books as its own receipt - so the
 * Payment records remain the ledger. This is the running total per method
 * kept on the bill itself, so the directory can say what a bill was paid by
 * without reading every receipt behind it.
 */
const paymentSplitSchema = new Schema(
  {
    method: { type: String, enum: COLLECTION_METHODS, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceItemSchema = new Schema(
  {
    test: {
      type: Schema.Types.ObjectId,
      ref: 'LabTest',
      required: true,
    },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    departmentName: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    // Where this line is actually run. Copied off the test master when the
    // bill is raised, but the desk can flip a single line - the bench machine
    // is down today and this one goes out, or a sent-out test is being run in
    // house this week. Frozen here so the bill still reads correctly after
    // the master changes.
    processingMode: {
      type: String,
      enum: ['In-house', 'Outsource'],
      default: 'In-house',
    },
    outsourceLab: { type: String, trim: true, default: '' },
    // What the referring doctor's own copy prints this line at. The patient
    // never sees it and it is never added into what they pay.
    referralRate: { type: Number, default: 0, min: 0 },
    // Set when the line came in as part of a panel, so the bill can group
    // the package back together and the package price can be traced.
    packageId: { type: Schema.Types.ObjectId, ref: 'TestPackage' },
    packageName: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    // The visit's own number, printed on the bill and the report as the
    // enquiry number. Sparse because bills raised before this existed have
    // none, and a plain unique index would read every one of those as a
    // duplicate null and refuse the second.
    enquiryNo: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    uhid: {
      type: String,
      required: true,
      index: true,
    },
    referringDoctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
    },
    // A prescription can arrive from any doctor in town. The desk types the
    // name whether or not that doctor is on the panel, so the referral is
    // never lost waiting for an Admin to add them to the master. Only a
    // paneled doctor (referringDoctor above) earns commission.
    referringDoctorName: { type: String, trim: true, default: '' },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    // Why the patient came in. Captured at the front desk during intake and
    // carried onto the report, so the pathologist reads the result against the
    // complaint rather than against a bare list of tests.
    chiefComplaint: { type: String, trim: true, default: '' },
    clinicalNotes: { type: String, trim: true, default: '' },
    priority: {
      type: String,
      enum: ['Routine', 'Urgent'],
      default: 'Routine',
      index: true,
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ['Percentage', 'Fixed'],
      default: 'Fixed',
    },
    discountValue: { type: Number, default: 0, min: 0 },
    discountReason: { type: String, default: '' },
    netAmount: { type: Number, required: true, min: 0 },
    // What the referring doctor's separate copy adds up to. Kept beside the
    // patient's total rather than derived on demand, so the doctor's bill
    // reprints years later at the rates that were agreed on the day.
    referralTotal: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Unpaid', 'Credit'],
      default: 'Unpaid',
      index: true,
    },
    /**
     * The tender the bill is filed under - the largest one when it was split.
     * Written out by hand here once, which left Cheque off the list while the
     * counter offered it, so a cheque bill failed validation on save. Read
     * from the one list every screen uses instead.
     */
    paymentMethod: {
      type: String,
      enum: COLLECTION_METHODS,
      default: 'Cash',
      index: true,
    },
    /** What came in by each method. One entry for a bill paid one way. */
    paymentBreakdown: { type: [paymentSplitSchema], default: [] },
    barcode: { type: String, required: true, index: true },
    createdBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ paymentStatus: 1, createdAt: -1 });
invoiceSchema.index({ referringDoctor: 1, createdAt: -1 });

export const Invoice = model<IInvoiceDocument>('Invoice', invoiceSchema);
