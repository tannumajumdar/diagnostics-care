import { z } from 'zod';

export const submitResultSchema = z.object({
  sampleId: z.string().min(1, 'Sample ID is required'),
  results: z.array(
    z.object({
      parameterName: z.string(),
      value: z.string(),
      unit: z.string().optional(),
      referenceRange: z.string().optional(),
      flag: z.enum(['Normal', 'Low', 'High', 'Critical']).optional(),
    })
  ),
});

export const saveResultSchema = submitResultSchema;
export const verifyResultSchema = z.object({
  action: z.enum(['Approve', 'Reject', 'Under Review']),
  rejectionReason: z.string().optional(),
});

