import { z } from 'zod';
import { COLLECTION_METHOD_VALUES } from '../constants/payment-methods';

/**
 * One line as the desk priced it. The rate and the line discount are what the
 * receptionist typed on the counter; both are optional, and a line with
 * neither is simply charged at the patient's rate card.
 */
const invoiceLineSchema = z.object({
  testId: z.string().min(1, 'Test is required on every line'),
  rate: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  // Where the line is run, what the referring doctor's copy prints it at, and
  // the panel it arrived in. All three default off the test master, so an
  // older client that posts none of them bills exactly as it used to.
  processingMode: z.enum(['In-house', 'Outsource']).optional(),
  outsourceLab: z.string().optional(),
  referralRate: z.number().min(0).optional(),
  packageId: z.string().optional(),
  packageName: z.string().optional(),
});

/** Either the priced lines or a bare list of ids - one of them must be there. */
const hasTests = (v: { testIds?: string[]; items?: unknown[] }) =>
  Boolean(v.testIds?.length) || Boolean(v.items?.length);

export const createInvoiceSchema = z
  .object({
    patientId: z.string().min(1, 'Patient ID is required'),
    doctorId: z.string().optional(),
    doctorName: z.string().optional(),
    organizationId: z.string().optional(),
    testIds: z.array(z.string()).optional(),
    items: z.array(invoiceLineSchema).optional(),
    discountType: z.enum(['Percentage', 'Fixed']).optional(),
    discountValue: z.number().min(0).optional(),
    discountReason: z.string().optional(),
    paidAmount: z.number().min(0).optional(),
    paymentMethod: z.enum(COLLECTION_METHOD_VALUES).optional(),
  })
  .refine(hasTests, { message: 'At least one test must be selected', path: ['testIds'] });

/** A brand-new patient captured during intake, before any UHID exists. */
const newPatientSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  gender: z.enum(['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child']),
  age: z.number().min(0, 'Enter a valid age'),
  mobile: z.string().min(10, 'Valid 10-digit mobile is required'),
  dateOfBirth: z.string().optional(),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
});

/**
 * One front-desk intake: who the patient is, which doctor sent them, what is
 * being run and what they paid. Either an existing patientId or the details of
 * a new one must be present.
 */
export const createVisitSchema = z
  .object({
    patientId: z.string().optional(),
    patient: newPatientSchema.optional(),
    // The desk no longer asks why the patient walked in - the referring
    // doctor's name and the tests ordered say it. Kept optional so older
    // clients and imported bills still post cleanly.
    chiefComplaint: z.string().optional(),
    clinicalNotes: z.string().optional(),
    priority: z.enum(['Routine', 'Urgent']).optional(),
    doctorId: z.string().optional(),
    doctorName: z.string().optional(),
    organizationId: z.string().optional(),
    testIds: z.array(z.string()).optional(),
    items: z.array(invoiceLineSchema).optional(),
    discountType: z.enum(['Percentage', 'Fixed']).optional(),
    discountValue: z.number().min(0).optional(),
    discountReason: z.string().optional(),
    paidAmount: z.number().min(0).optional(),
    paymentMethod: z.enum(COLLECTION_METHOD_VALUES).optional(),
  })
  .refine((v) => Boolean(v.patientId) || Boolean(v.patient), {
    message: 'Select an existing patient or fill in the new patient details',
    path: ['patientId'],
  })
  .refine(hasTests, { message: 'At least one test must be selected', path: ['testIds'] });

export const addPaymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.enum(COLLECTION_METHOD_VALUES),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
});

