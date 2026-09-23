"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Counter = void 0;
exports.getNextSequenceValue = getNextSequenceValue;
exports.getNextUhid = getNextUhid;
exports.getNextEnquiryNumber = getNextEnquiryNumber;
exports.getNextInvoiceNumber = getNextInvoiceNumber;
exports.getNextReceiptNumber = getNextReceiptNumber;
exports.getNextSampleId = getNextSampleId;
exports.getNextBarcode = getNextBarcode;
exports.getNextResultId = getNextResultId;
exports.getNextAppointmentId = getNextAppointmentId;
exports.getNextRefundId = getNextRefundId;
exports.getNextExpenseId = getNextExpenseId;
exports.getNextTransactionId = getNextTransactionId;
const mongoose_1 = require("mongoose");
const counterSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});
exports.Counter = (0, mongoose_1.model)('Counter', counterSchema);
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await exports.Counter.findOneAndUpdate({ name: sequenceName }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    return sequenceDocument.seq;
}
async function getNextUhid() {
    const seq = await getNextSequenceValue('uhid');
    const year = new Date().getFullYear();
    return `UHID-${year}-${seq.toString().padStart(6, '0')}`;
}
/**
 * The number the patient quotes when they ring to ask about their report.
 *
 * One per visit, not one per patient: the UHID identifies the person and never
 * changes, so a patient on their third visit has one UHID and three enquiry
 * numbers. That is what lets the desk tell which draw is being asked about
 * when a returning patient rings - the UHID alone cannot.
 */
async function getNextEnquiryNumber() {
    const seq = await getNextSequenceValue('enquiry');
    const year = new Date().getFullYear();
    return `ENQ-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextInvoiceNumber() {
    const seq = await getNextSequenceValue('invoice');
    const year = new Date().getFullYear();
    return `INV-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextReceiptNumber() {
    const seq = await getNextSequenceValue('receipt');
    const year = new Date().getFullYear();
    return `RCT-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextSampleId() {
    const seq = await getNextSequenceValue('sample');
    const year = new Date().getFullYear();
    return `SMP-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextBarcode() {
    const seq = await getNextSequenceValue('barcode');
    const year = new Date().getFullYear();
    return `BAR-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextResultId() {
    const seq = await getNextSequenceValue('result');
    const year = new Date().getFullYear();
    return `RES-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextAppointmentId() {
    const seq = await getNextSequenceValue('appointment');
    const year = new Date().getFullYear();
    return `APT-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextRefundId() {
    const seq = await getNextSequenceValue('refund');
    const year = new Date().getFullYear();
    return `RFD-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextExpenseId() {
    const seq = await getNextSequenceValue('expense');
    const year = new Date().getFullYear();
    return `EXP-${year}-${seq.toString().padStart(6, '0')}`;
}
async function getNextTransactionId() {
    const seq = await getNextSequenceValue('paymentTransaction');
    const year = new Date().getFullYear();
    return `PGT-${year}-${seq.toString().padStart(6, '0')}`;
}
