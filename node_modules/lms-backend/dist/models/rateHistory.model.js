"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateHistory = void 0;
const mongoose_1 = require("mongoose");
const rateHistorySchema = new mongoose_1.Schema({
    test: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LabTest',
        required: true,
        index: true,
    },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    previousRates: {
        rate: { type: Number, required: true },
        patientRate: { type: Number, required: true },
        corporateRate: { type: Number, required: true },
        doctorRate: { type: Number, required: true },
        emergencyRate: { type: Number, required: true },
        // Added after the first tariffs were written, so the older rows in the
        // trail simply do not carry it.
        referralRate: { type: Number },
    },
    newRates: {
        rate: { type: Number, required: true },
        patientRate: { type: Number, required: true },
        corporateRate: { type: Number, required: true },
        doctorRate: { type: Number, required: true },
        emergencyRate: { type: Number, required: true },
        referralRate: { type: Number },
    },
    reason: { type: String, default: '' },
    changedBy: {
        userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
    },
}, {
    timestamps: true,
});
exports.RateHistory = (0, mongoose_1.model)('RateHistory', rateHistorySchema);
