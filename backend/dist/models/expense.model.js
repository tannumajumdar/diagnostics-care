"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payout = exports.Expense = void 0;
const mongoose_1 = require("mongoose");
const expense_interface_1 = require("../types/expense.interface");
const payment_methods_1 = require("../constants/payment-methods");
/**
 * The outgoing-cash ledger: every rupee the centre hands to an ambulance
 * driver, courier, referring doctor or supplier. Modelled as one document per
 * payment so the payout report can be totalled by payee, by type and by day.
 */
const expenseSchema = new mongoose_1.Schema({
    expenseId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    payeeType: {
        type: String,
        enum: expense_interface_1.PAYEE_TYPES,
        default: 'Other',
        index: true,
    },
    payeeName: {
        type: String,
        required: [true, 'Who the money is paid to is required'],
        trim: true,
        index: true,
    },
    payeeContact: {
        type: String,
        trim: true,
        default: '',
    },
    category: {
        type: String,
        required: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Payout amount must be greater than zero'],
    },
    paymentMethod: {
        type: String,
        enum: payment_methods_1.DISBURSEMENT_METHODS,
        default: 'Cash',
    },
    referenceNo: {
        type: String,
        trim: true,
        default: '',
    },
    expenseDate: {
        type: Date,
        default: Date.now,
        index: true,
    },
    status: {
        type: String,
        enum: expense_interface_1.PAYOUT_STATUSES,
        default: 'Paid',
        index: true,
    },
    needsApproval: {
        type: Boolean,
        default: false,
    },
    // An ambulance run or a doctor cut usually traces back to one visit, so the
    // payout can be opened from the patient or the bill it belongs to.
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Patient',
    },
    invoice: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Invoice',
    },
    // Set when the payee is a referring doctor, so commission paid can be
    // reconciled against commission earned without matching on names.
    doctor: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Doctor',
    },
    recordedBy: {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String },
    },
    approvedBy: {
        userId: { type: String },
        name: { type: String },
        role: { type: String },
        at: { type: Date },
    },
    rejectionReason: {
        type: String,
        default: '',
    },
    receiptUrl: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});
exports.Expense = (0, mongoose_1.model)('Expense', expenseSchema);
/** Domain name for the same collection - the ledger is read as payouts. */
exports.Payout = exports.Expense;
