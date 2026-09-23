import { Document } from 'mongoose';
import { RefundStage } from '../constants/refund-policy';

export interface IRefundStageRule {
  /** Whether a test may be cancelled for a refund at all at this stage. */
  allowed: boolean;
  /** How much of the line's billed amount goes back, in percent. */
  refundPercent: number;
}

export interface IRefundPolicyDocument extends Document {
  /** One document, always. `singleton` is what keeps it that way. */
  singleton: string;
  /** Off means no test can be cancelled for a refund from the counter at all. */
  enabled: boolean;
  stages: Record<RefundStage, IRefundStageRule>;
  /** Flat amount the centre keeps per cancelled test, on top of the stage rate. */
  cancellationFee: number;
  /** How long after the bill a cancellation is still entertained, in days. */
  refundWindowDays: number;
  fullRefundOnLabRejection: boolean;
  allowAdminOverride: boolean;
  /** Printed for the patient and shown on the cancellation screen. */
  policyNote: string;
  updatedBy?: {
    userId: string;
    name: string;
    role: string;
    at: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
