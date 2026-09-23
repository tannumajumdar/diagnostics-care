"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
const payment_methods_1 = require("../constants/payment-methods");
const paymentSchema = new mongoose_1.Schema({
    receiptNumber: {
        type: String,
        unique: true,
        required: true,
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
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    paymentMethod: {
        type: String,
        enum: payment_methods_1.COLLECTION_METHODS,
        required: true,
    },
    transactionRef: { type: String, default: '' },
    notes: { type: String, default: '' },
    receivedBy: {
        userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
    },
}, {
    timestamps: true,
});
exports.Payment = (0, mongoose_1.model)('Payment', paymentSchema);
