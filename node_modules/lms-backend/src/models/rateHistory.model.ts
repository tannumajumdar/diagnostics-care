import { Schema, model } from 'mongoose';
import { IRateHistoryDocument } from '../types/rateHistory.interface';

const rateHistorySchema = new Schema<IRateHistoryDocument>(
  {
    test: {
      type: Schema.Types.ObjectId,
      ref: 'LabTest',
      required: true,
      index: true,
    },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    previousRates: {
      rate: { type: Number, required: true },
      patientRate: { type: Number, required: true },
      corporateRate: { type: Number, required: true },
      doctorRate: { type: Number, required: true },
      emergencyRate: { type: Number, required: true },
      // Added after the first tariffs were written, so the older rows in the
      // trail simply do not carry it.
      referralRate: { type: Number },
    },
    newRates: {
      rate: { type: Number, required: true },
      patientRate: { type: Number, required: true },
      corporateRate: { type: Number, required: true },
      doctorRate: { type: Number, required: true },
      emergencyRate: { type: Number, required: true },
      referralRate: { type: Number },
    },
    reason: { type: String, default: '' },
    changedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

export const RateHistory = model<IRateHistoryDocument>('RateHistory', rateHistorySchema);
