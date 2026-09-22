"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestPackage = void 0;
const mongoose_1 = require("mongoose");
const roles_1 = require("../constants/roles");
/**
 * A panel the centre sells as one thing - "Full Body Checkup", "Fever
 * Profile", an ante-natal package.
 *
 * It is a price, not a test: the tests inside it stay ordinary catalogue
 * tests, are drawn, run and reported exactly as they are on any other bill,
 * and the package only decides what the whole set costs. Billing spreads that
 * price back across the lines it contains, so the lab side never has to know
 * a package existed while the bill still adds up to the package price.
 */
const packageSchema = new mongoose_1.Schema({
    packageName: {
        type: String,
        required: [true, 'Package name is required'],
        trim: true,
    },
    packageCode: {
        type: String,
        required: [true, 'Package code is required'],
        trim: true,
        uppercase: true,
        unique: true,
        index: true,
    },
    description: { type: String, trim: true, default: '' },
    tests: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'LabTest',
            required: true,
        },
    ],
    rate: { type: Number, required: [true, 'Package rate is required'], min: 0 },
    // Printed on the referring doctor's copy, the way a single test's
    // referral rate is. Zero means "no separate doctor price", and the
    // doctor's bill falls back to the tests' own referral rates.
    referralRate: { type: Number, default: 0, min: 0 },
    discountAllowed: { type: Boolean, default: true },
    status: {
        type: String,
        enum: roles_1.ALL_STATUSES,
        required: [true, 'Status is required'],
        default: 'Active',
    },
}, {
    timestamps: true,
});
exports.TestPackage = (0, mongoose_1.model)('TestPackage', packageSchema);
