import { Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createDepartmentSchema, updateDepartmentSchema } from '../validators/department.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), DepartmentController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.MASTER_VIEW), DepartmentController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest(createDepartmentSchema),
  DepartmentController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest(updateDepartmentSchema),
  DepartmentController.update
);
router.patch('/:id/status', requirePermission(PERMISSIONS.DEPARTMENT_MANAGE), DepartmentController.toggleStatus);

export default router;
