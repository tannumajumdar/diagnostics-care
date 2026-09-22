import { z } from 'zod';

export const createOrganizationSchema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  mobile: z.string().min(10, 'Mobile is required'),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

