"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTestsSchema = exports.updateRefundPolicySchema = void 0;
const zod_1 = require("zod");
const payment_methods_1 = require("../constants/payment-methods");
const refund_policy_1 = require("../constants/refund-policy");
const stageRule = zod_1.z.object({
    allowed: zod_1.z.boolean().optional(),
    refundPercent: zod_1.z.number().min(0, 'A refund share cannot be negative').max(100, 'A refund share cannot exceed 100%').optional(),
});
/**
 * Keyed off the one stage list, so a stage added there is accepted here
 * without this file being edited too. Every entry is optional - the screen
 * may save one row at a time.
 */
const stages = zod_1.z.record(zod_1.z.enum(refund_policy_1.REFUND_STAGE_ORDER), stageRule);
exports.updateRefundPolicySchema = zod_1.z.object({
    body: zod_1.z.object({
        enabled: zod_1.z.boolean().optional(),
        stages: stages.optional(),
        cancellationFee: zod_1.z.number().min(0, 'A cancellation fee cannot be negative').optional(),
        refundWindowDays: zod_1.z.number().int().min(0, 'The cancellation window cannot be negative').optional(),
        fullRefundOnLabRejection: zod_1.z.boolean().optional(),
        allowAdminOverride: zod_1.z.boolean().optional(),
        policyNote: zod_1.z.string().max(2000, 'Keep the policy note under 2000 characters').optional(),
    }),
});
exports.cancelTestsSchema = zod_1.z.object({
    body: zod_1.z.object({
        invoiceId: zod_1.z.string().min(1, 'Invoice ID is required'),
        itemIndexes: zod_1.z.array(zod_1.z.number().int().min(0)).min(1, 'Pick at least one test to cancel'),
        reason: zod_1.z.string().min(2, 'A reason for the cancellation is required'),
        paymentMethod: zod_1.z.enum(payment_methods_1.DISBURSEMENT_METHOD_VALUES),
        remarks: zod_1.z.string().optional(),
        overrideAmount: zod_1.z.number().min(0).optional(),
        overrideReason: zod_1.z.string().optional(),
    }),
});
