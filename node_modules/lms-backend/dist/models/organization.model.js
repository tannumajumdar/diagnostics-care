"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Organization = void 0;
const mongoose_1 = require("mongoose");
const roles_1 = require("../constants/roles");
const organizationSchema = new mongoose_1.Schema({
    organizationName: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        unique: true,
    },
    contactPerson: {
        type: String,
        required: [true, 'Contact person is required'],
        trim: true,
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
    },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, default: '' },
    contractRate: {
        type: String,
        enum: ['Corporate', 'Standard', 'Discounted'],
        default: 'Corporate',
    },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    creditLimit: { type: Number, default: 0, min: 0 },
    paymentTerms: {
        type: String,
        enum: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'],
        default: 'Net 30',
    },
    status: {
        type: String,
        enum: roles_1.ALL_STATUSES,
        required: [true, 'Status is required'],
        default: 'Active',
    },
}, {
    timestamps: true,
});
exports.Organization = (0, mongoose_1.model)('Organization', organizationSchema);
