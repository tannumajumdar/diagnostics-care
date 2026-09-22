import api from './axios';

/** One collection attempt, as the desk's screen sees it. */
export interface PaymentAttempt {
  txnId: string;
  /**
   * The handle the simulator panel acts with. Stands in for a real provider's
   * webhook signature - nothing outside the simulator should use it.
   */
  payerToken: string;
  method: 'UPI' | 'Card';
  amount: number;
  status: 'Pending' | 'Success' | 'Failed' | 'Expired' | 'Cancelled';
  pending: boolean;
  secondsLeft: number;
  expiresAt: string;
  vpa: string;
  upiIntent: string;
  payeeVpa: string;
  payeeName: string;
  utr: string;
  cardLast4: string;
  cardNetwork: string;
  authCode: string;
  rrn: string;
  failureReason: string;
  completedAt: string | null;
  receiptNumber: string;
  createdAt: string;
}

export const paymentGatewayApi = {
  initiate: async (payload: {
    invoiceId: string;
    amount: number;
    method: 'UPI' | 'Card';
    vpa?: string;
  }): Promise<PaymentAttempt> => api.post('/payment-gateway/initiate', payload),

  /** Polled while the attempt is live. The gateway, not the desk, decides. */
  getStatus: async (txnId: string): Promise<PaymentAttempt> => api.get(`/payment-gateway/${txnId}`),

  cancel: async (txnId: string): Promise<PaymentAttempt> => api.post(`/payment-gateway/${txnId}/cancel`),

  listForInvoice: async (invoiceId: string): Promise<PaymentAttempt[]> =>
    api.get(`/payment-gateway/invoice/${invoiceId}`),

  /**
   * Stands in for the patient's phone and for the card terminal. A real
   * deployment deletes this along with the panel that calls it - the outcome
   * would arrive as a webhook from the bank instead.
   */
  simulate: async (
    txnId: string,
    payload: {
      token: string;
      outcome: 'success' | 'failure';
      reason?: string;
      cardLast4?: string;
      cardNetwork?: string;
      vpa?: string;
    }
  ): Promise<PaymentAttempt> => api.post(`/payment-gateway/${txnId}/simulate`, payload),
};
