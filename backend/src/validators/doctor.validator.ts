import { z } from 'zod';

export const createDoctorSchema = z.object({
  doctorName: z.string().min(2, 'Doctor name is required'),
  department: z.string().min(1, 'Department is required'),
  mobile: z.string().min(10, 'Valid mobile number is required'),
  email: z.string().email().optional().or(z.literal('')),
});

export const updateDoctorSchema = createDoctorSchema.partial();

