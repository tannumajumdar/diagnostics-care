import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import {
  createAppointmentSchema,
  assignPhlebotomistSchema,
  updateAppointmentStatusSchema,
} from '../validators/appointment.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.APPOINTMENT_VIEW), AppointmentController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.APPOINTMENT_VIEW), AppointmentController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  validateRequest(createAppointmentSchema),
  AppointmentController.create
);
router.patch(
  '/:id/assign',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  validateRequest(assignPhlebotomistSchema),
  AppointmentController.assignPhlebotomist
);
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE),
  validateRequest(updateAppointmentStatusSchema),
  AppointmentController.updateStatus
);

export default router;
