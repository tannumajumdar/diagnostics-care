"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = exports.resetPasswordSchema = exports.updateUserSchema = exports.createUserSchema = exports.changePasswordSchema = exports.refreshTokenSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const roles_1 = require("../constants/roles");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(6),
    newPassword: zod_1.z.string().min(6),
});
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is required'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    // Constrained to the live role list, so a typo cannot create an account
    // holding a role the permission matrix has never heard of.
    role: zod_1.z.enum(roles_1.ALL_ROLES, {
        errorMap: () => ({ message: `Role must be one of: ${roles_1.ALL_ROLES.join(', ')}` }),
    }),
    mobile: zod_1.z.string().min(6, 'Mobile number is required'),
    status: zod_1.z.enum(['Active', 'Inactive']).optional(),
});
exports.updateUserSchema = exports.createUserSchema.partial();
/** An Admin setting someone else's password - no old password to supply. */
exports.resetPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const validateRequest = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.errors?.[0]?.message || 'Validation failed' });
    }
};
exports.validateRequest = validateRequest;
