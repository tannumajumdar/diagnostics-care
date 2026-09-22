import { z } from 'zod';

export const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().optional(),
    patientName: z.string().min(2, 'Patient name required'),
    mobile: z.string().min(10, 'Valid 10-digit mobile number required'),
    doctorId: z.string().optional(),
    testIds: z.array(z.string()).optional(),
    date: z.string().min(1, 'Date is required'),
    time: z.string().min(1, 'Time slot is required'),
    collectionType: z.enum(['Lab Visit', 'Home Collection']),
    address: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const assignPhlebotomistSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'Phlebotomist user ID required'),
    name: z.string().min(1, 'Phlebotomist name required'),
    mobile: z.string().optional(),
  }),
});

export const updateAppointmentStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'Pending',
      'Confirmed',
      'Assigned',
      'On The Way',
      'Collected',
      'Submitted',
      'Completed',
      'Cancelled',
    ]),
    notes: z.string().optional(),
  }),
});
