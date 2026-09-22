import { z } from 'zod';

/**
 * What the package master screen sends. The tests are ids from the catalogue;
 * a panel with nothing in it would bill a price against no work, so at least
 * one is required.
 */
export const createPackageSchema = z.object({
  packageName: z.string().min(2, 'Package name is required'),
  packageCode: z.string().min(2, 'Package code is required'),
  description: z.string().optional(),
  tests: z.array(z.string().min(1)).min(1, 'Add at least one test to the package'),
  rate: z.number().min(0, 'Package rate must be positive'),
  referralRate: z.number().min(0).optional(),
  discountAllowed: z.boolean().optional(),
  status: z.string().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();
