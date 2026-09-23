import api from './axios';

/** One stage's rule: whether a cancellation is entertained, and for how much. */
export interface RefundStageRule {
  allowed: boolean;
  refundPercent: number;
}

export interface RefundPolicy {
  enabled: boolean;
  stages: Record<string, RefundStageRule>;
  cancellationFee: number;
  refundWindowDays: number;
  fullRefundOnLabRejection: boolean;
  allowAdminOverride: boolean;
  policyNote: string;
  updatedBy?: { userId: string; name: string; role: string; at: string };
  updatedAt?: string;
}

export interface RefundPolicyScreen {
  policy: RefundPolicy;
  stageOrder: string[];
  stageLabels: Record<string, { label: string; description: string }>;
  defaults: RefundPolicy;
}

/** One line of a bill, priced for cancellation against the policy. */
export interface CancellationQuoteItem {
  index: number;
  testName: string;
  testCode: string;
  departmentName: string;
  packageName: string;
  lineValue: number;
  cancelled: boolean;
  refundedAmount: number;
  sampleId: string | null;
  sampleStatus: string;
  stage: string;
  stageLabel: string;
  refundPercent: number;
  cancellationFee: number;
  refundable: number;
  eligible: boolean;
  blockers: string[];
}

export interface CancellationQuote {
  invoice: {
    id: string;
    invoiceNumber: string;
    enquiryNo: string;
    patient: any;
    netAmount: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: string;
    billedAt: string;
  };
  policy: {
    enabled: boolean;
    refundWindowDays: number;
    cancellationFee: number;
    allowAdminOverride: boolean;
    policyNote: string;
  };
  daysSinceBill: number;
  windowOpen: boolean;
  items: CancellationQuoteItem[];
  totalRefundable: number;
}

export interface CancelTestsParams {
  invoiceId: string;
  itemIndexes: number[];
  reason: string;
  paymentMethod: string;
  remarks?: string;
  overrideAmount?: number;
  overrideReason?: string;
}

/**
 * The centre's return policy, and cancelling a test against it - what the
 * patient gets back when they decide against a test they have been billed for.
 */
export const refundPolicyApi = {
  get: async (): Promise<any> => api.get('/refund-policy'),
  update: async (data: Partial<RefundPolicy>): Promise<any> => api.put('/refund-policy', data),

  /** What each line on a bill is worth back today. Writes nothing. */
  getQuote: async (invoiceId: string): Promise<any> => api.get(`/refund-policy/quote/${invoiceId}`),

  cancelTests: async (data: CancelTestsParams): Promise<any> => api.post('/refund-policy/cancel-tests', data),
};
