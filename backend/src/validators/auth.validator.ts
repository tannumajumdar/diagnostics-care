import { z } from 'zod';
import { ALL_ROLES } from '../constants/roles';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  // Constrained to the live role list, so a typo cannot create an account
  // holding a role the permission matrix has never heard of.
  role: z.enum(ALL_ROLES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: `Role must be one of: ${ALL_ROLES.join(', ')}` }),
  }),
  mobile: z.string().min(6, 'Mobile number is required'),
  status: z.enum(['Active', 'Inactive']).optional(),
});

export const updateUserSchema = createUserSchema.partial();

/** An Admin setting someone else's password - no old password to supply. */
export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const validateRequest = (schema: z.ZodSchema) => (req: any, res: any, next: any) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.errors?.[0]?.message || 'Validation failed' });
  }
};

