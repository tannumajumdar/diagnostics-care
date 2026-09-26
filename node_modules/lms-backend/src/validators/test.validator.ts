import { z } from 'zod';

/**
 * What the master screen sends when a test is added.
 *
 * The rate tiers are optional here on purpose: the form asks for one standard
 * rate and the controller starts the whole card from it. What is listed as
 * required is what the model refuses to store without, so a missing field is
 * answered with a plain sentence instead of a mongoose validation dump.
 */
export const createTestSchema = z.object({
  testName: z.string().min(2, 'Test name is required'),
  testCode: z.string().min(2, 'Test code is required'),
  department: z.string().min(1, 'Department is required'),
  rate: z.number().min(0, 'Rate must be positive'),
  sampleType: z.string().optional(),
  sampleContainer: z.string().optional(),
  turnaroundTime: z.string().optional(),
  testType: z.enum(['Routine', 'Special', 'Urgent', 'Profile']).optional(),
  patientRate: z.number().min(0).optional(),
  corporateRate: z.number().min(0).optional(),
  doctorRate: z.number().min(0).optional(),
  emergencyRate: z.number().min(0).optional(),
  referralRate: z.number().min(0).optional(),
  processingMode: z.enum(['In-house', 'Outsource']).optional(),
  outsourceLab: z.string().optional(),
  outsourceCost: z.number().min(0).optional(),
  tpa: z.string().nullable().optional(),
  /** An existing test whose parameter sheet is copied onto this one. */
  importParametersFrom: z.string().optional(),
  discountAllowed: z.boolean().optional(),
  fastingRequired: z.boolean().optional(),
  preparationRequired: z.string().optional(),
  parameters: z.array(z.any()).optional(),
  status: z.string().optional(),
});

export const createLabTestSchema = createTestSchema;
export const updateLabTestSchema = createTestSchema.partial();
export const updateRatesSchema = z.object({
  rates: z.object({
    rate: z.number().optional(),
    patientRate: z.number().optional(),
    corporateRate: z.number().optional(),
    doctorRate: z.number().optional(),
    emergencyRate: z.number().optional(),
    referralRate: z.number().optional(),
  }),
  reason: z.string().optional(),
});

