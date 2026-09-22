import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createPatientSchema, updatePatientSchema } from '../validators/patient.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.PATIENT_VIEW), PatientController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.PATIENT_VIEW), PatientController.getById);
// Pulling up an older patient: past visits, bills, samples and reports.
router.get('/:id/history', requirePermission(PERMISSIONS.PATIENT_HISTORY), PatientController.getHistory);

router.post(
  '/',
  requirePermission(PERMISSIONS.PATIENT_CREATE),
  validateRequest(createPatientSchema),
  PatientController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.PATIENT_EDIT),
  validateRequest(updatePatientSchema),
  PatientController.update
);
router.patch('/:id/status', requirePermission(PERMISSIONS.PATIENT_EDIT), PatientController.toggleStatus);

export default router;
