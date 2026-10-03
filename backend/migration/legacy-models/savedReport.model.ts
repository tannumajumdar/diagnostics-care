import { Schema, model, Document, Types } from 'mongoose';

/**
 * A report PDF as it was saved - the exact file handed to the patient, kept so
 * it can be found and downloaded again later without regenerating it. Every
 * save is its own row, so a report saved twice (say after a correction) keeps
 * both copies.
 */
export interface ISavedReportDocument extends Document {
  result: Types.ObjectId;
  patient?: Types.ObjectId;
  patientName: string;
  uhid: string;
  mobile?: string;
  invoice?: Types.ObjectId;
  invoiceNumber?: string;
  enquiryNo?: string;
  reportNo: string;
  status: 'Provisional' | 'Final';
  tests: string[];
  fileName: string;
  size: number;
  data: Buffer;
  savedBy: { userId?: string; name?: string; role?: string };
  createdAt: Date;
  updatedAt: Date;
}

const savedReportSchema = new Schema<any>(
  {
    result: { type: Schema.Types.ObjectId, ref: 'Result', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    patientName: { type: String, trim: true, default: '' },
    uhid: { type: String, trim: true, default: '', index: true },
    mobile: { type: String, trim: true, default: '' },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    invoiceNumber: { type: String, trim: true, default: '' },
    enquiryNo: { type: String, trim: true, default: '' },
    reportNo: { type: String, trim: true, default: '' },
    // Provisional: saved from result entry before the pathologist approved it.
    status: { type: String, enum: ['Provisional', 'Final'], default: 'Final', index: true },
    tests: { type: [String], default: [] },
    fileName: { type: String, required: true },
    size: { type: Number, default: 0 },
    // The PDF itself. Left out of every query unless asked for, so the list
    // never drags the files along with it.
    data: { type: Buffer, required: true, select: false },
    savedBy: {
      userId: { type: String },
      name: { type: String },
      role: { type: String },
    },
  },
  { timestamps: true }
);

savedReportSchema.index({ createdAt: -1 });

export const SavedReport = model<any>('SavedReport', savedReportSchema);
