import { z } from 'zod';
import { DISBURSEMENT_METHOD_VALUES } from '../constants/payment-methods';
import { REFUND_STAGE_ORDER, RefundStage } from '../constants/refund-policy';

const stageRule = z.object({
  allowed: z.boolean().optional(),
  refundPercent: z.number().min(0, 'A refund share cannot be negative').max(100, 'A refund share cannot exceed 100%').optional(),
});

/**
 * Keyed off the one stage list, so a stage added there is accepted here
 * without this file being edited too. Every entry is optional - the screen
 * may save one row at a time.
 */
const stages = z.record(z.enum(REFUND_STAGE_ORDER as [RefundStage, ...RefundStage[]]), stageRule);

export const updateRefundPolicySchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    stages: stages.optional(),
    cancellationFee: z.number().min(0, 'A cancellation fee cannot be negative').optional(),
    refundWindowDays: z.number().int().min(0, 'The cancellation window cannot be negative').optional(),
    fullRefundOnLabRejection: z.boolean().optional(),
    allowAdminOverride: z.boolean().optional(),
    policyNote: z.string().max(2000, 'Keep the policy note under 2000 characters').optional(),
  }),
});

export const cancelTestsSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
    itemIndexes: z.array(z.number().int().min(0)).min(1, 'Pick at least one test to cancel'),
    reason: z.string().min(2, 'A reason for the cancellation is required'),
    paymentMethod: z.enum(DISBURSEMENT_METHOD_VALUES),
    remarks: z.string().optional(),
    overrideAmount: z.number().min(0).optional(),
    overrideReason: z.string().optional(),
  }),
});
