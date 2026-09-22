import { Schema, model } from 'mongoose';
import { IPaymentDocument } from '../types/payment.interface';
import { COLLECTION_METHODS } from '../constants/payment-methods';

const paymentSchema = new Schema<IPaymentDocument>(
  {
    receiptNumber: {
      type: String,
      unique: true,
      required: true,
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
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: COLLECTION_METHODS,
      required: true,
    },
    transactionRef: { type: String, default: '' },
    notes: { type: String, default: '' },
    receivedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = model<IPaymentDocument>('Payment', paymentSchema);
