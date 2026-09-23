import { Schema, model } from 'mongoose';
import { IRefundPolicyDocument } from '../types/refundPolicy.interface';
import { DEFAULT_REFUND_POLICY, REFUND_STAGE_ORDER } from '../constants/refund-policy';

const stageRuleSchema = new Schema(
  {
    allowed: { type: Boolean, default: true },
    refundPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

/**
 * The centre's return policy, as one editable record.
 *
 * It is a master like any other - the Admin writes it once on the Refund
 * Policy screen and the counter then works off it, rather than each staff
 * member deciding at the window what a cancelled test is worth back.
 */
const refundPolicySchema = new Schema<IRefundPolicyDocument>(
  {
    // There is only ever one policy. A fixed key with a unique index is what
    // makes "create it if it is missing" safe to call from anywhere.
    singleton: { type: String, default: 'refund-policy', unique: true, index: true },
    enabled: { type: Boolean, default: DEFAULT_REFUND_POLICY.enabled },
    stages: {
      type: new Schema(
        Object.fromEntries(
          REFUND_STAGE_ORDER.map((stage) => [stage, { type: stageRuleSchema, default: () => ({}) }])
        ),
        { _id: false }
      ),
      default: () => DEFAULT_REFUND_POLICY.stages,
    },
    cancellationFee: { type: Number, default: DEFAULT_REFUND_POLICY.cancellationFee, min: 0 },
    refundWindowDays: { type: Number, default: DEFAULT_REFUND_POLICY.refundWindowDays, min: 0 },
    fullRefundOnLabRejection: { type: Boolean, default: DEFAULT_REFUND_POLICY.fullRefundOnLabRejection },
    allowAdminOverride: { type: Boolean, default: DEFAULT_REFUND_POLICY.allowAdminOverride },
    policyNote: { type: String, trim: true, default: DEFAULT_REFUND_POLICY.policyNote },
    updatedBy: {
      userId: { type: String },
      name: { type: String },
      role: { type: String },
      at: { type: Date },
    },
  },
  { timestamps: true }
);

export const RefundPolicy = model<IRefundPolicyDocument>('RefundPolicy', refundPolicySchema);
