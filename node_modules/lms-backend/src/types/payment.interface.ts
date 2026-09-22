import { Document, Types } from 'mongoose';

export interface IPaymentDocument extends Document {
  receiptNumber: string;
  invoice: Types.ObjectId;
  patient: Types.ObjectId;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Online' | 'Credit';
  transactionRef?: string;
  notes?: string;
  receivedBy: {
    userId: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

