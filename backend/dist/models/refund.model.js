"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Refund = void 0;
const mongoose_1 = require("mongoose");
const refundSchema = new mongoose_1.Schema({
    refundId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    invoice: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true,
        index: true,
    },
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    },
    originalAmount: {
        type: Number,
        required: true,
    },
    refundAmount: {
        type: Number,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online'],
        required: true,
    },
    approvedBy: {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
    },
    date: {
        type: Date,
        default: Date.now,
    },
    remarks: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});
exports.Refund = (0, mongoose_1.model)('Refund', refundSchema);
