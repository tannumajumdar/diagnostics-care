import { z } from 'zod';

export const updateSampleStatusSchema = z.object({
  status: z.enum([
    'Registered',
    'Pending Collection',
    'Collected',
    'Received',
    'Processing',
    'Completed',
    'Rejected',
    'Recollected',
    'Cancelled',
  ]),
  rejectionReason: z.string().optional(),
  remarks: z.string().optional(),
  collector: z.string().optional(),
  /** When the draw actually happened, if it is being recorded after the fact. */
  collectedAt: z.string().optional(),
});

export const rejectSampleSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
  rejectionRemarks: z.string().optional(),
  remarks: z.string().optional(),
});

