import { Schema, model } from 'mongoose';

export interface ICounter {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model<ICounter>('Counter', counterSchema);

export async function getNextSequenceValue(sequenceName: string): Promise<number> {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.seq;
}

export async function getNextUhid(): Promise<string> {
  const seq = await getNextSequenceValue('uhid');
  const year = new Date().getFullYear();
  return `UHID-${year}-${seq.toString().padStart(6, '0')}`;
}

/**
 * The number the patient quotes when they ring to ask about their report.
 *
 * One per visit, not one per patient: the UHID identifies the person and never
 * changes, so a patient on their third visit has one UHID and three enquiry
 * numbers. That is what lets the desk tell which draw is being asked about
 * when a returning patient rings - the UHID alone cannot.
 */
export async function getNextEnquiryNumber(): Promise<string> {
  const seq = await getNextSequenceValue('enquiry');
  const year = new Date().getFullYear();
  return `ENQ-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextInvoiceNumber(): Promise<string> {
  const seq = await getNextSequenceValue('invoice');
  const year = new Date().getFullYear();
  return `INV-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextReceiptNumber(): Promise<string> {
  const seq = await getNextSequenceValue('receipt');
  const year = new Date().getFullYear();
  return `RCT-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextSampleId(): Promise<string> {
  const seq = await getNextSequenceValue('sample');
  const year = new Date().getFullYear();
  return `SMP-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextBarcode(): Promise<string> {
  const seq = await getNextSequenceValue('barcode');
  const year = new Date().getFullYear();
  return `BAR-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextResultId(): Promise<string> {
  const seq = await getNextSequenceValue('result');
  const year = new Date().getFullYear();
  return `RES-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextAppointmentId(): Promise<string> {
  const seq = await getNextSequenceValue('appointment');
  const year = new Date().getFullYear();
  return `APT-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextRefundId(): Promise<string> {
  const seq = await getNextSequenceValue('refund');
  const year = new Date().getFullYear();
  return `RFD-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextExpenseId(): Promise<string> {
  const seq = await getNextSequenceValue('expense');
  const year = new Date().getFullYear();
  return `EXP-${year}-${seq.toString().padStart(6, '0')}`;
}

export async function getNextTransactionId(): Promise<string> {
  const seq = await getNextSequenceValue('paymentTransaction');
  const year = new Date().getFullYear();
  return `PGT-${year}-${seq.toString().padStart(6, '0')}`;
}
