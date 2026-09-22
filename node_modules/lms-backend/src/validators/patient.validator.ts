import { z } from 'zod';

export const createPatientSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  gender: z.enum(['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child']),
  age: z.number().min(0, 'Age must be non-negative'),
  mobile: z.string().min(10, 'Valid mobile is required'),
});

export const updatePatientSchema = createPatientSchema.partial();

