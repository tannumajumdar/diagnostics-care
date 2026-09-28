import { StoredDocument, Ref } from './document';

export interface IPaymentDocument extends StoredDocument {
  receiptNumber: string;
  invoice: Ref;
  patient: Ref;
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

