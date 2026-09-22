import { z } from 'zod';

export const createDepartmentSchema = z.object({
  departmentName: z.string().min(2, 'Department name is required'),
  departmentCode: z.string().min(2, 'Department code is required'),
  description: z.string().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

