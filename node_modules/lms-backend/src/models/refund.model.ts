import { Schema, model } from 'mongoose';
import { IRefundDocument } from '../types/refund.interface';
import { DISBURSEMENT_METHODS } from '../constants/payment-methods';

const refundSchema = new Schema<IRefundDocument>(
  {
    refundId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    refundAmount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: DISBURSEMENT_METHODS,
      required: true,
    },
    approvedBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    date: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Refund = model<IRefundDocument>('Refund', refundSchema);
