"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundPolicyService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const refundPolicy_model_1 = require("../models/refundPolicy.model");
const invoice_model_1 = require("../models/invoice.model");
const sample_model_1 = require("../models/sample.model");
const refund_model_1 = require("../models/refund.model");
const counter_model_1 = require("../models/counter.model");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
const refund_policy_1 = require("../constants/refund-policy");
/**
 * Where a line's work had got to, read off the specimen rather than asked of
 * the person standing at the counter.
 */
const stageForSample = (sample, policy) => {
    if (!sample)
        return refund_policy_1.REFUND_STAGES.BEFORE_COLLECTION;
    switch (sample.status) {
        case 'Registered':
        case 'Pending Collection':
        case 'Recollected':
            return refund_policy_1.REFUND_STAGES.BEFORE_COLLECTION;
        case 'Collected':
        case 'Received':
            return refund_policy_1.REFUND_STAGES.AFTER_COLLECTION;
        case 'Processing':
            return refund_policy_1.REFUND_STAGES.AFTER_PROCESSING;
        case 'Completed':
            return refund_policy_1.REFUND_STAGES.AFTER_REPORT;
        case 'Rejected':
            // The lab spoilt this one. Charging the patient for a draw they are
            // being asked to repeat is exactly what the switch is there to prevent.
            return policy.fullRefundOnLabRejection
                ? refund_policy_1.REFUND_STAGES.BEFORE_COLLECTION
                : refund_policy_1.REFUND_STAGES.AFTER_COLLECTION;
        default:
            return refund_policy_1.REFUND_STAGES.BEFORE_COLLECTION;
    }
};
const round = (value) => Math.max(0, Math.round(value));
class RefundPolicyService {
    /** The policy, created from the defaults the first time anyone asks for it. */
    static async getPolicy() {
        const existing = await refundPolicy_model_1.RefundPolicy.findOne({ singleton: 'refund-policy' });
        if (existing)
            return existing;
        return refundPolicy_model_1.RefundPolicy.create({ singleton: 'refund-policy', ...refund_policy_1.DEFAULT_REFUND_POLICY });
    }
    /** The policy plus the labels the screen needs, so it renders off one call. */
    static async getPolicyForScreen() {
        const policy = await this.getPolicy();
        return {
            policy,
            stageOrder: refund_policy_1.REFUND_STAGE_ORDER,
            stageLabels: refund_policy_1.REFUND_STAGE_LABELS,
            defaults: refund_policy_1.DEFAULT_REFUND_POLICY,
        };
    }
    static async updatePolicy(payload, currentUser) {
        if (!(0, permissions_1.can)(currentUser?.role, permissions_1.PERMISSIONS.REFUND_POLICY_MANAGE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Only an Admin can change the refund policy');
        }
        const policy = await this.getPolicy();
        if (typeof payload.enabled === 'boolean')
            policy.enabled = payload.enabled;
        if (payload.stages) {
            refund_policy_1.REFUND_STAGE_ORDER.forEach((stage) => {
                const rule = payload.stages[stage];
                if (!rule)
                    return;
                if (typeof rule.allowed === 'boolean')
                    policy.stages[stage].allowed = rule.allowed;
                if (rule.refundPercent !== undefined) {
                    const percent = Number(rule.refundPercent);
                    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
                        throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, refund_policy_1.REFUND_STAGE_LABELS[stage].label + ': the refund share must be between 0 and 100 percent');
                    }
                    policy.stages[stage].refundPercent = percent;
                }
            });
        }
        if (payload.cancellationFee !== undefined) {
            policy.cancellationFee = Math.max(0, Number(payload.cancellationFee) || 0);
        }
        if (payload.refundWindowDays !== undefined) {
            policy.refundWindowDays = Math.max(0, Number(payload.refundWindowDays) || 0);
        }
        if (typeof payload.fullRefundOnLabRejection === 'boolean') {
            policy.fullRefundOnLabRejection = payload.fullRefundOnLabRejection;
        }
        if (typeof payload.allowAdminOverride === 'boolean') {
            policy.allowAdminOverride = payload.allowAdminOverride;
        }
        if (payload.policyNote !== undefined)
            policy.policyNote = String(payload.policyNote);
        policy.updatedBy = {
            userId: String(currentUser.userId || ''),
            name: currentUser.name,
            role: currentUser.role,
            at: new Date(),
        };
        await policy.save();
        return policy;
    }
    /**
     * What the counter is told before anything is handed back: every line on a
     * bill, how far its work had got, and what the policy says is owed back on
     * it. Nothing is written - this is only the quote the patient is read.
     */
    static async quoteForInvoice(invoiceId) {
        const policy = await this.getPolicy();
        const invoice = await invoice_model_1.Invoice.findById(invoiceId).populate('patient', 'patientName uhid mobile').lean();
        if (!invoice)
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Invoice not found');
        const samples = await sample_model_1.Sample.find({ invoice: invoice._id }).select('test status sampleId').lean();
        const sampleByTest = new Map(samples.map((s) => [String(s.test), s]));
        const billedAt = new Date(invoice.createdAt);
        const daysSinceBill = Math.floor((Date.now() - billedAt.getTime()) / 86400000);
        const windowOpen = policy.refundWindowDays === 0 || daysSinceBill <= policy.refundWindowDays;
        const items = (invoice.items || []).map((item, index) => {
            const sample = sampleByTest.get(String(item.test));
            const stage = stageForSample(sample, policy);
            const rule = policy.stages[stage];
            const lineValue = Number(item.netAmount) || 0;
            const gross = round((lineValue * (rule?.refundPercent || 0)) / 100);
            const refundable = round(gross - policy.cancellationFee);
            const blockers = [];
            if (item.cancelled)
                blockers.push('Already cancelled');
            if (!policy.enabled)
                blockers.push('Refund on cancellation is switched off for this centre');
            if (!rule?.allowed)
                blockers.push('No refund at this stage: ' + refund_policy_1.REFUND_STAGE_LABELS[stage].label);
            if (!windowOpen) {
                blockers.push('Past the ' + policy.refundWindowDays + '-day cancellation window (billed ' + daysSinceBill + ' days ago)');
            }
            return {
                index,
                testName: item.testName,
                testCode: item.testCode,
                departmentName: item.departmentName,
                packageName: item.packageName || '',
                lineValue,
                cancelled: !!item.cancelled,
                refundedAmount: Number(item.refundedAmount) || 0,
                sampleId: sample?.sampleId || null,
                sampleStatus: sample?.status || 'Not registered',
                stage,
                stageLabel: refund_policy_1.REFUND_STAGE_LABELS[stage].label,
                refundPercent: rule?.refundPercent || 0,
                cancellationFee: policy.cancellationFee,
                /** What the patient gets back if this line is cancelled right now. */
                refundable: blockers.length ? 0 : refundable,
                eligible: blockers.length === 0,
                blockers,
            };
        });
        return {
            invoice: {
                id: String(invoice._id),
                invoiceNumber: invoice.invoiceNumber,
                enquiryNo: invoice.enquiryNo || '',
                patient: invoice.patient,
                netAmount: invoice.netAmount,
                paidAmount: invoice.paidAmount,
                dueAmount: invoice.dueAmount,
                paymentStatus: invoice.paymentStatus,
                billedAt,
            },
            policy: {
                enabled: policy.enabled,
                refundWindowDays: policy.refundWindowDays,
                cancellationFee: policy.cancellationFee,
                allowAdminOverride: policy.allowAdminOverride,
                policyNote: policy.policyNote,
            },
            daysSinceBill,
            windowOpen,
            items,
            totalRefundable: items.reduce((sum, item) => sum + item.refundable, 0),
        };
    }
    /**
     * The patient does not want these tests after all.
     *
     * What comes off the bill is what the policy says the centre is not entitled
     * to keep. Of that, whatever the patient had actually paid comes back as
     * cash and the rest simply stops being owed. The lines stay on the bill,
     * struck through rather than deleted - a bill that silently loses a line
     * cannot be reconciled against the receipt the patient is holding.
     */
    static async cancelTestsAndRefund(payload, currentUser) {
        if (!(0, permissions_1.can)(currentUser?.role, permissions_1.PERMISSIONS.REFUND_ISSUE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Your role is not permitted to cancel a test and refund it');
        }
        const { invoiceId, itemIndexes, reason, paymentMethod, remarks = '' } = payload;
        if (!Array.isArray(itemIndexes) || itemIndexes.length === 0) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Pick at least one test to cancel');
        }
        const policy = await this.getPolicy();
        if (!policy.enabled) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Refund on cancellation is switched off. An Admin can turn it on from the Refund Policy screen.');
        }
        const quote = await this.quoteForInvoice(invoiceId);
        const invoice = await invoice_model_1.Invoice.findById(invoiceId);
        if (!invoice)
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Invoice not found');
        const picked = itemIndexes.map((index) => {
            const line = quote.items[index];
            if (!line)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'This bill has no line ' + (index + 1));
            if (line.cancelled) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, line.testName + ' is already cancelled');
            }
            return line;
        });
        const usingOverride = payload.overrideAmount !== undefined && payload.overrideAmount !== null;
        if (usingOverride) {
            if (!policy.allowAdminOverride) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'This centre does not allow overriding the refund policy');
            }
            if (!(0, permissions_1.can)(currentUser?.role, permissions_1.PERMISSIONS.REFUND_POLICY_MANAGE)) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Only an Admin can override the refund policy');
            }
            if (!payload.overrideReason) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'A reason is required when overriding the refund policy');
            }
        }
        else {
            const blocked = picked.find((line) => !line.eligible);
            if (blocked) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, blocked.testName + ' cannot be refunded: ' + blocked.blockers.join('; '));
            }
        }
        const lineValueTotal = picked.reduce((sum, line) => sum + line.lineValue, 0);
        const policyTotal = picked.reduce((sum, line) => sum + line.refundable, 0);
        let creditTotal = policyTotal;
        if (usingOverride) {
            const override = Number(payload.overrideAmount);
            if (Number.isNaN(override) || override < 0) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'A refund cannot be negative');
            }
            if (override > lineValueTotal) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Rs.' + override + ' is more than these tests were billed at (Rs.' + lineValueTotal + ')');
            }
            creditTotal = round(override);
        }
        // Money only comes back out of money that came in. Whatever the patient
        // had not paid yet simply stops being owed instead.
        const cashRefund = Math.min(creditTotal, invoice.paidAmount);
        // The credit is spread back across the lines in proportion to what each
        // was billed at, so a two-test cancellation stays traceable line by line.
        const shares = picked.map((line) => lineValueTotal > 0 ? round((creditTotal * line.lineValue) / lineValueTotal) : 0);
        // Rounding drift lands on the last line, so the shares always add back up
        // to the figure the patient was actually quoted.
        const drift = creditTotal - shares.reduce((sum, share) => sum + share, 0);
        if (shares.length)
            shares[shares.length - 1] = Math.max(0, shares[shares.length - 1] + drift);
        const stamp = {
            userId: String(currentUser.userId || ''),
            name: currentUser.name,
            role: currentUser.role,
        };
        picked.forEach((line, i) => {
            const item = invoice.items[line.index];
            item.cancelled = true;
            item.cancelledAt = new Date();
            item.cancellationReason = reason;
            item.refundedAmount = shares[i];
            item.retainedAmount = Math.max(0, line.lineValue - shares[i]);
            item.cancelledBy = stamp;
        });
        invoice.netAmount = Math.max(0, invoice.netAmount - creditTotal);
        invoice.paidAmount = Math.max(0, invoice.paidAmount - cashRefund);
        invoice.dueAmount = Math.max(0, invoice.netAmount - invoice.paidAmount);
        invoice.paymentStatus = invoice.dueAmount === 0 ? 'Paid' : invoice.paidAmount === 0 ? 'Unpaid' : 'Partial';
        await invoice.save();
        // The specimens behind the cancelled lines come off the bench queues -
        // unless the work is already finished, because a released result is not
        // withdrawn by a refund.
        const cancelledTestIds = picked.map((line) => invoice.items[line.index].test);
        await sample_model_1.Sample.updateMany({ invoice: invoice._id, test: { $in: cancelledTestIds }, status: { $nin: ['Completed', 'Cancelled'] } }, {
            $set: {
                status: 'Cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason,
            },
        });
        // A refund record is the receipt for money leaving the drawer. Nothing
        // left it when the bill was still unpaid, so none is written in that case -
        // the cancellation is on the bill either way.
        let refund = null;
        if (cashRefund > 0) {
            const rawUserId = currentUser.userId || currentUser.id;
            const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
            refund = await refund_model_1.Refund.create({
                refundId: await (0, counter_model_1.getNextRefundId)(),
                invoice: invoice._id,
                patient: invoice.patient,
                originalAmount: lineValueTotal,
                refundAmount: cashRefund,
                reason: 'Test cancelled by patient - ' + reason,
                paymentMethod,
                approvedBy: { userId, name: currentUser.name, role: currentUser.role },
                date: new Date(),
                remarks: [
                    picked.map((line) => line.testName).join(', '),
                    usingOverride ? 'Policy overridden: ' + payload.overrideReason : '',
                    remarks,
                ]
                    .filter(Boolean)
                    .join(' | '),
            });
        }
        return {
            refund,
            invoice,
            cancelled: picked.map((line, i) => ({
                testName: line.testName,
                stage: line.stageLabel,
                billedAt: line.lineValue,
                refunded: shares[i],
                retained: Math.max(0, line.lineValue - shares[i]),
            })),
            /** Taken off the bill: cash handed back plus what stopped being owed. */
            creditTotal,
            cashRefund,
            dueWaived: creditTotal - cashRefund,
            retainedTotal: Math.max(0, lineValueTotal - creditTotal),
            policyOverridden: usingOverride,
        };
    }
}
exports.RefundPolicyService = RefundPolicyService;
