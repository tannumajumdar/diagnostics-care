import { StoredDocument, Ref } from './document';

export interface IRefundDocument extends StoredDocument {
  refundId: string;
  invoice: Ref;
  patient: Ref;
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
