"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Patient = void 0;
const mongoose_1 = require("mongoose");
const roles_1 = require("../constants/roles");
const patientSchema = new mongoose_1.Schema({
    uhid: {
        type: String,
        unique: true,
        required: true,
        index: true,
    },
    patientName: {
        type: String,
        required: [true, 'Patient name is required'],
        trim: true,
        index: true,
    },
    gender: {
        type: String,
        // 'Child' is legacy - registered before the sex of a child was recorded.
        // It stays accepted so those patients can still be edited and billed.
        enum: ['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child'],
        required: [true, 'Gender is required'],
    },
    dateOfBirth: { type: Date },
    age: {
        type: Number,
        required: [true, 'Age is required'],
        min: 0,
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
        index: true,
    },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pinCode: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    referringDoctor: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Doctor',
        index: true,
    },
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true,
    },
    registrationDate: {
        type: Date,
        default: Date.now,
        index: true,
    },
    status: {
        type: String,
        enum: roles_1.ALL_STATUSES,
        required: [true, 'Status is required'],
        default: 'Active',
        index: true,
    },
}, {
    timestamps: true,
});
patientSchema.index({ status: 1, registrationDate: -1 });
exports.Patient = (0, mongoose_1.model)('Patient', patientSchema);
