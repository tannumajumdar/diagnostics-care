"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPaymentSchema = exports.reviseInvoiceSchema = exports.createVisitSchema = exports.createInvoiceSchema = void 0;
const zod_1 = require("zod");
const payment_methods_1 = require("../constants/payment-methods");
/**
 * One line as the desk priced it. The rate and the line discount are what the
 * receptionist typed on the counter; both are optional, and a line with
 * neither is simply charged at the patient's rate card.
 */
const invoiceLineSchema = zod_1.z.object({
    testId: zod_1.z.string().min(1, 'Test is required on every line'),
    rate: zod_1.z.number().min(0).optional(),
    discountAmount: zod_1.z.number().min(0).optional(),
    // Where the line is run, what the referring doctor's copy prints it at, and
    // the panel it arrived in. All three default off the test master, so an
    // older client that posts none of them bills exactly as it used to.
    processingMode: zod_1.z.enum(['In-house', 'Outsource']).optional(),
    outsourceLab: zod_1.z.string().optional(),
    referralRate: zod_1.z.number().min(0).optional(),
    packageId: zod_1.z.string().optional(),
    packageName: zod_1.z.string().optional(),
});
/**
 * One leg of a payment: an amount and the method it came in by. A patient
 * settling half in cash and half by UPI posts two of these against one bill.
 */
const paymentTenderSchema = zod_1.z.object({
    method: zod_1.z.enum(payment_methods_1.COLLECTION_METHOD_VALUES),
    amount: zod_1.z.number().min(0.01, 'Every payment line must be greater than 0'),
    transactionRef: zod_1.z.string().optional(),
});
/** Either the priced lines or a bare list of ids - one of them must be there. */
const hasTests = (v) => Boolean(v.testIds?.length) || Boolean(v.items?.length);
exports.createInvoiceSchema = zod_1.z
    .object({
    patientId: zod_1.z.string().min(1, 'Patient ID is required'),
    doctorId: zod_1.z.string().optional(),
    doctorName: zod_1.z.string().optional(),
    organizationId: zod_1.z.string().optional(),
    testIds: zod_1.z.array(zod_1.z.string()).optional(),
    items: zod_1.z.array(invoiceLineSchema).optional(),
    discountType: zod_1.z.enum(['Percentage', 'Fixed']).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    discountReason: zod_1.z.string().optional(),
    // Who the concession came through - a different question from who
    // referred the patient, and only recorded when a discount was given.
    discountDoctorId: zod_1.z.string().optional(),
    discountDoctorName: zod_1.z.string().optional(),
    paidAmount: zod_1.z.number().min(0).optional(),
    paymentMethod: zod_1.z.enum(payment_methods_1.COLLECTION_METHOD_VALUES).optional(),
    paymentSplits: zod_1.z.array(paymentTenderSchema).optional(),
})
    .refine(hasTests, { message: 'At least one test must be selected', path: ['testIds'] });
/** A brand-new patient captured during intake, before any UHID exists. */
const newPatientSchema = zod_1.z.object({
    patientName: zod_1.z.string().min(2, 'Patient name is required'),
    gender: zod_1.z.enum(['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child']),
    age: zod_1.z.number().min(0, 'Enter a valid age'),
    mobile: zod_1.z.string().min(10, 'Valid 10-digit mobile is required'),
    dateOfBirth: zod_1.z.string().optional(),
    emergencyContact: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    pinCode: zod_1.z.string().optional(),
});
/**
 * One front-desk intake: who the patient is, which doctor sent them, what is
 * being run and what they paid. Either an existing patientId or the details of
 * a new one must be present.
 */
exports.createVisitSchema = zod_1.z
    .object({
    patientId: zod_1.z.string().optional(),
    patient: newPatientSchema.optional(),
    // The desk no longer asks why the patient walked in - the referring
    // doctor's name and the tests ordered say it. Kept optional so older
    // clients and imported bills still post cleanly.
    chiefComplaint: zod_1.z.string().optional(),
    clinicalNotes: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['Routine', 'Urgent']).optional(),
    doctorId: zod_1.z.string().optional(),
    doctorName: zod_1.z.string().optional(),
    organizationId: zod_1.z.string().optional(),
    testIds: zod_1.z.array(zod_1.z.string()).optional(),
    items: zod_1.z.array(invoiceLineSchema).optional(),
    discountType: zod_1.z.enum(['Percentage', 'Fixed']).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    discountReason: zod_1.z.string().optional(),
    // Who the concession came through - a different question from who
    // referred the patient, and only recorded when a discount was given.
    discountDoctorId: zod_1.z.string().optional(),
    discountDoctorName: zod_1.z.string().optional(),
    paidAmount: zod_1.z.number().min(0).optional(),
    paymentMethod: zod_1.z.enum(payment_methods_1.COLLECTION_METHOD_VALUES).optional(),
    paymentSplits: zod_1.z.array(paymentTenderSchema).optional(),
})
    .refine((v) => Boolean(v.patientId) || Boolean(v.patient), {
    message: 'Select an existing patient or fill in the new patient details',
    path: ['patientId'],
})
    .refine(hasTests, { message: 'At least one test must be selected', path: ['testIds'] });
/**
 * A bill being changed after it was raised - a test added at the counter, a
 * concession agreed when the patient came back to settle. Everything is
 * optional, and a revision that changes nothing is refused below rather than
 * written as an empty entry in the bill's history.
 */
exports.reviseInvoiceSchema = zod_1.z
    .object({
    addItems: zod_1.z.array(invoiceLineSchema).optional(),
    discountType: zod_1.z.enum(['Percentage', 'Fixed']).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    discountReason: zod_1.z.string().optional(),
    discountDoctorId: zod_1.z.string().optional(),
    discountDoctorName: zod_1.z.string().optional(),
    clinicalNotes: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['Routine', 'Urgent']).optional(),
    revisionNote: zod_1.z.string().optional(),
})
    .refine((v) => Boolean(v.addItems?.length) ||
    v.discountType !== undefined ||
    v.discountValue !== undefined ||
    v.discountReason !== undefined ||
    v.discountDoctorId !== undefined ||
    v.discountDoctorName !== undefined ||
    v.clinicalNotes !== undefined ||
    v.priority !== undefined, { message: 'Add a test or change the discount - there is nothing to revise', path: ['addItems'] });
/**
 * Collecting against a bill, by one method or several. The single-method form
 * is what every older client posts and stays valid; `paymentSplits` is the
 * counter taking part in cash and the rest on the machine.
 */
exports.addPaymentSchema = zod_1.z
    .object({
    amount: zod_1.z.number().min(0.01, 'Payment amount must be greater than 0').optional(),
    paymentMethod: zod_1.z.enum(payment_methods_1.COLLECTION_METHOD_VALUES).optional(),
    paymentSplits: zod_1.z.array(paymentTenderSchema).optional(),
    transactionRef: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
})
    .refine((v) => Boolean(v.paymentSplits?.length) || (Boolean(v.amount) && Boolean(v.paymentMethod)), {
    message: 'Enter an amount and a method, or split the payment across methods',
    path: ['amount'],
});
