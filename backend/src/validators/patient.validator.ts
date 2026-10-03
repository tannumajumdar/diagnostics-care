import { z } from 'zod';
import { isAbhaNumber, isAbhaAddress, isPatientPhoto, ABHA_STATUSES, ID_PROOF_TYPES, idProofError } from '../utils/abha.util';

/** Existing or new ABHA, and the ID proof - shared with the intake's new patient. */
export const identityFields = {
  abhaStatus: z.enum(['', ...ABHA_STATUSES]).optional(),
  idProofType: z.enum(['', ...ID_PROOF_TYPES]).optional(),
  idProofNumber: z.string().optional(),
  photo: z.string().optional().refine(isPatientPhoto, { message: 'Photo must be a JPEG or PNG image under 375 KB' }),
};

/** The ID number has to fit its proof, and a new ABHA is made from one. */
export const checkIdentity = (data: Record<string, any>, ctx: z.RefinementCtx): void => {
  if ('idProofType' in data || 'idProofNumber' in data) {
    const message = idProofError(data.idProofType, data.idProofNumber);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['idProofNumber'] });
  }
  if (data.abhaStatus === 'New' && !data.idProofType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A new ABHA needs an ID proof', path: ['idProofType'] });
  }
};

const patientSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  gender: z.enum(['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child']),
  age: z.number().min(0, 'Age must be non-negative'),
  mobile: z.string().min(10, 'Valid mobile is required'),
  abhaNumber: z
    .string()
    .optional()
    .refine(isAbhaNumber, { message: 'ABHA number must be 14 digits, like 12-3456-7890-1234' }),
  abhaAddress: z
    .string()
    .optional()
    .refine(isAbhaAddress, { message: 'ABHA address must look like name@abdm' }),
  ...identityFields,
});

export const createPatientSchema = patientSchema.superRefine(checkIdentity);

export const updatePatientSchema = patientSchema.partial().superRefine(checkIdentity);

