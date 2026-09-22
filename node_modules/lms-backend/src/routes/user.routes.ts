import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../validators/auth.validator';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// Staff accounts are the Admin's alone - creating a login is how someone gets
// into the centre's records at all.
router.get('/', requirePermission(PERMISSIONS.STAFF_MANAGE), UserController.getAllUsers);
// Literal segment before '/:id' so "collectors" is not read as an ObjectId.
// The front desk needs this list to assign a home visit, nothing more.
router.get(
  '/collectors',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE, PERMISSIONS.SAMPLE_VIEW),
  UserController.getCollectors
);
router.post(
  '/',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateRequest(createUserSchema),
  UserController.createUser
);
router.get('/:id', requirePermission(PERMISSIONS.STAFF_MANAGE), UserController.getUserById);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateRequest(updateUserSchema),
  UserController.updateUser
);
// Setting someone else's password, for the member who is locked out and so
// cannot use the self-service change that asks for the old one.
router.patch(
  '/:id/password',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validateRequest(resetPasswordSchema),
  UserController.resetPassword
);
router.patch('/:id/status', requirePermission(PERMISSIONS.STAFF_MANAGE), UserController.toggleStatus);

export default router;
