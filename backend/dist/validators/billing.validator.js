"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPaymentSchema = exports.createVisitSchema = exports.createInvoiceSchema = void 0;
const zod_1 = require("zod");
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
    paidAmount: zod_1.z.number().min(0).optional(),
    paymentMethod: zod_1.z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online', 'Credit']).optional(),
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
    paidAmount: zod_1.z.number().min(0).optional(),
    paymentMethod: zod_1.z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online', 'Credit']).optional(),
})
    .refine((v) => Boolean(v.patientId) || Boolean(v.patient), {
    message: 'Select an existing patient or fill in the new patient details',
    path: ['patientId'],
})
    .refine(hasTests, { message: 'At least one test must be selected', path: ['testIds'] });
exports.addPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().min(0.01, 'Payment amount must be greater than 0'),
    paymentMethod: zod_1.z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online', 'Credit']),
    transactionRef: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
