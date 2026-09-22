import { Document, Types } from 'mongoose';

export interface IRefundDocument extends Document {
  refundId: string;
  invoice: Types.ObjectId;
  patient: Types.ObjectId;
  originalAmount: number;
  refundAmount: number;
  reason: string;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Online';
  approvedBy: {
    userId: string;
    name: string;
    role: string;
  };
  date: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}
