import { z } from 'zod';

// Everything past the first three is optional; the database fills its defaults.
const details = {
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), 'GSTIN must be 15 characters, like 22ABCDE1234F1Z5')
    .optional(),
  contractRate: z.enum(['Corporate', 'Standard', 'Discounted']).optional(),
  discount: z.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%').optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').optional(),
  paymentTerms: z.enum(['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate']).optional(),
};

export const createOrganizationSchema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  mobile: z.string().min(10, 'Mobile is required'),
  ...details,
});

export const updateOrganizationSchema = createOrganizationSchema.partial();
