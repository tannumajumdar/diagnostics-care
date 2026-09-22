import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createDoctorSchema, updateDoctorSchema } from '../validators/doctor.validator';

const router = Router();

router.use(authenticate);

// The front desk must be able to pick a referring doctor while billing, so
// reading the panel is open to any desk that sees the masters. Adding or
// editing a doctor is an Admin action.
router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), DoctorController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.MASTER_VIEW), DoctorController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.DOCTOR_MANAGE),
  validateRequest(createDoctorSchema),
  DoctorController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.DOCTOR_MANAGE),
  validateRequest(updateDoctorSchema),
  DoctorController.update
);
router.patch('/bulk/cut-value', requirePermission(PERMISSIONS.DOCTOR_MANAGE), DoctorController.setCutValue);
router.patch('/:id/status', requirePermission(PERMISSIONS.DOCTOR_MANAGE), DoctorController.toggleStatus);

export default router;
