import api from './axios';
import type { PayeeType } from '../types';

export interface CreateRefundParams {
  invoiceId: string;
  refundAmount: number;
  reason: string;
  paymentMethod: string;
  remarks?: string;
}

export interface CreatePayoutParams {
  payeeType: PayeeType;
  payeeName: string;
  payeeContact?: string;
  description: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  expenseDate?: string;
  patientId?: string;
  invoiceId?: string;
  doctorId?: string;
}

export interface PayoutFilters {
  payeeType?: string;
  payeeName?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface LedgerFilters {
  patientId?: string;
  search?: string;
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
  handledBy?: string;
  paymentMethod?: string;
  flowType?: 'all' | 'collection' | 'payout' | 'refund';
  payeeType?: string;
  page?: number;
  limit?: number;
}

export const accountsApi = {
  getDailyCollections: async (date?: string): Promise<any> =>
    api.get('/accounts/collections/daily', { params: { date } }),

  /** One row per calendar day - what came in, and how, across a window. */
  getCollectionTrend: async (params?: { from?: string; to?: string; days?: number }): Promise<any> =>
    api.get('/accounts/collections/trend', { params }),

  /**
   * Everything the centre has ever taken, with no window around it - what is
   * billed, collected, refunded, paid out and still owed since it opened.
   */
  getOverallCollections: async (): Promise<any> => api.get('/accounts/collections/overall'),

  /** Unified Patient Ledger & Cash Flow report */
  getLedger: async (params?: LedgerFilters): Promise<any> =>
    api.get('/accounts/ledger', { params }),

  getAllRefunds: async (params?: any): Promise<any> => api.get('/accounts/refunds', { params }),
  createRefund: async (data: CreateRefundParams): Promise<any> => api.post('/accounts/refunds', data),

  getAllPayouts: async (params?: PayoutFilters): Promise<any> => api.get('/accounts/payouts', { params }),
  getPayoutSummary: async (params?: { from?: string; to?: string }): Promise<any> =>
    api.get('/accounts/payouts/summary', { params }),
  createPayout: async (data: CreatePayoutParams): Promise<any> => api.post('/accounts/payouts', data),
  updatePayoutStatus: async (id: string, data: { status: 'Paid' | 'Rejected'; rejectionReason?: string }): Promise<any> =>
    api.patch(`/accounts/payouts/${id}/status`, data),
  deletePayout: async (id: string): Promise<any> => api.delete(`/accounts/payouts/${id}`),

  getDoctorCommissions: async (): Promise<any> => api.get('/accounts/doctor-commissions'),
};
