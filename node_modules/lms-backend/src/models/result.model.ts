import { Schema, model } from 'mongoose';
import { IResultDocument } from '../types/result.interface';

const parameterResultSchema = new Schema(
  {
    parameterId: { type: String },
    parameterName: { type: String, required: true },
    shortName: { type: String },
    // Not required: a sheet is created the moment the bench opens the sample,
    // with every line blank and waiting to be typed. Requiring a value here
    // made Mongoose reject the empty sheet outright ('' counts as missing).
    value: { type: String, default: '' },
    unit: { type: String, default: '' },
    referenceRange: { type: String, default: '' },
    flag: {
      type: String,
      enum: ['Normal', 'Low', 'High', 'Critical'],
      default: 'Normal',
    },
    method: { type: String, default: '' },
    remarks: { type: String, default: '' },
    resultType: { type: String, default: 'Numeric' },
    dropdownOptions: [{ type: String }],
    // Carried over from the test master so a re-flag on save uses the same
    // limits the sheet was built with, even if the master is edited later.
    criticalLow: { type: String, default: '' },
    criticalHigh: { type: String, default: '' },
    // The master's HIGH / LOW RANGE values for the band this patient fell in.
    highRange: { type: String, default: '' },
    lowRange: { type: String, default: '' },
    displayOrder: { type: Number, default: 1 },
  },
  { _id: false }
);

const resultVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    changedBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    results: [parameterResultSchema],
    status: { type: String, required: true },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const resultSchema = new Schema<IResultDocument>(
  {
    resultId: {
      type: String,
      required: true,
      unique: true,
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
    // Copied off the invoice so the bench and the report can show the visit's
    // enquiry number without loading the bill. Absent on anything raised
    // before enquiry numbers existed.
    enquiryNo: {
      type: String,
      index: true,
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    sample: {
      type: Schema.Types.ObjectId,
      ref: 'Sample',
      required: true,
      unique: true,
      index: true,
    },
    test: {
      type: Schema.Types.ObjectId,
      ref: 'LabTest',
      required: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    results: [parameterResultSchema],
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Final'],
      default: 'Draft',
      index: true,
    },
    overallRemarks: {
      type: String,
      default: '',
    },
    enteredBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
    verifiedBy: {
      userId: { type: String },
      name: { type: String },
      role: { type: String },
      date: { type: Date },
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    versions: [resultVersionSchema],
  },
  {
    timestamps: true,
  }
);

export const Result = model<IResultDocument>('Result', resultSchema);

