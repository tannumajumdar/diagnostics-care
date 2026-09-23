"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentTransaction = exports.TERMINAL_STATUSES = exports.TRANSACTION_STATUSES = void 0;
const mongoose_1 = require("mongoose");
exports.TRANSACTION_STATUSES = ['Pending', 'Success', 'Failed', 'Expired', 'Cancelled'];
/** Once a transaction reaches one of these, nothing moves it again. */
exports.TERMINAL_STATUSES = ['Success', 'Failed', 'Expired', 'Cancelled'];
const paymentTransactionSchema = new mongoose_1.Schema({
    txnId: { type: String, required: true, unique: true, index: true },
    invoice: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    patient: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['UPI', 'Card'], required: true },
    status: { type: String, enum: exports.TRANSACTION_STATUSES, default: 'Pending', index: true },
    vpa: { type: String, default: '', trim: true },
    upiIntent: { type: String, default: '' },
    utr: { type: String, default: '' },
    cardLast4: { type: String, default: '' },
    cardNetwork: { type: String, default: '' },
    authCode: { type: String, default: '' },
    rrn: { type: String, default: '' },
    payerToken: { type: String, required: true, select: false },
    failureReason: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
    payment: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Payment' },
    initiatedBy: {
        userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
    },
}, { timestamps: true });
paymentTransactionSchema.index({ createdAt: -1 });
exports.PaymentTransaction = (0, mongoose_1.model)('PaymentTransaction', paymentTransactionSchema);
