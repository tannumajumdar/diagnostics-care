"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Appointment = void 0;
const mongoose_1 = require("mongoose");
const appointmentSchema = new mongoose_1.Schema({
    appointmentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Patient',
        index: true,
    },
    patientName: {
        type: String,
        required: true,
        trim: true,
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
    },
    doctor: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Doctor',
    },
    tests: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'LabTest',
        },
    ],
    date: {
        type: Date,
        required: true,
        index: true,
    },
    time: {
        type: String,
        required: true,
    },
    collectionType: {
        type: String,
        enum: ['Lab Visit', 'Home Collection'],
        default: 'Lab Visit',
        index: true,
    },
    address: {
        type: String,
        default: '',
    },
    phlebotomist: {
        userId: { type: String },
        name: { type: String },
        mobile: { type: String },
    },
    status: {
        type: String,
        enum: [
            'Pending',
            'Confirmed',
            'Assigned',
            'On The Way',
            'Collected',
            'Submitted',
            'Completed',
            'Cancelled',
        ],
        default: 'Pending',
        index: true,
    },
    notes: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});
exports.Appointment = (0, mongoose_1.model)('Appointment', appointmentSchema);
