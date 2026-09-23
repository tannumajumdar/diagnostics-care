"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundPolicy = void 0;
const mongoose_1 = require("mongoose");
const refund_policy_1 = require("../constants/refund-policy");
const stageRuleSchema = new mongoose_1.Schema({
    allowed: { type: Boolean, default: true },
    refundPercent: { type: Number, default: 0, min: 0, max: 100 },
}, { _id: false });
/**
 * The centre's return policy, as one editable record.
 *
 * It is a master like any other - the Admin writes it once on the Refund
 * Policy screen and the counter then works off it, rather than each staff
 * member deciding at the window what a cancelled test is worth back.
 */
const refundPolicySchema = new mongoose_1.Schema({
    // There is only ever one policy. A fixed key with a unique index is what
    // makes "create it if it is missing" safe to call from anywhere.
    singleton: { type: String, default: 'refund-policy', unique: true, index: true },
    enabled: { type: Boolean, default: refund_policy_1.DEFAULT_REFUND_POLICY.enabled },
    stages: {
        type: new mongoose_1.Schema(Object.fromEntries(refund_policy_1.REFUND_STAGE_ORDER.map((stage) => [stage, { type: stageRuleSchema, default: () => ({}) }])), { _id: false }),
        default: () => refund_policy_1.DEFAULT_REFUND_POLICY.stages,
    },
    cancellationFee: { type: Number, default: refund_policy_1.DEFAULT_REFUND_POLICY.cancellationFee, min: 0 },
    refundWindowDays: { type: Number, default: refund_policy_1.DEFAULT_REFUND_POLICY.refundWindowDays, min: 0 },
    fullRefundOnLabRejection: { type: Boolean, default: refund_policy_1.DEFAULT_REFUND_POLICY.fullRefundOnLabRejection },
    allowAdminOverride: { type: Boolean, default: refund_policy_1.DEFAULT_REFUND_POLICY.allowAdminOverride },
    policyNote: { type: String, trim: true, default: refund_policy_1.DEFAULT_REFUND_POLICY.policyNote },
    updatedBy: {
        userId: { type: String },
        name: { type: String },
        role: { type: String },
        at: { type: Date },
    },
}, { timestamps: true });
exports.RefundPolicy = (0, mongoose_1.model)('RefundPolicy', refundPolicySchema);
