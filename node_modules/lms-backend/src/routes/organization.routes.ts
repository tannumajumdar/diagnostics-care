import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createOrganizationSchema, updateOrganizationSchema } from '../validators/organization.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), OrganizationController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.MASTER_VIEW), OrganizationController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  validateRequest(createOrganizationSchema),
  OrganizationController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  validateRequest(updateOrganizationSchema),
  OrganizationController.update
);
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  OrganizationController.toggleStatus
);

export default router;
