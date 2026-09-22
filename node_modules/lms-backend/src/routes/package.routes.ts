import { Router } from 'express';
import { PackageController } from '../controllers/package.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createPackageSchema, updatePackageSchema } from '../validators/package.validator';

const router = Router();

router.use(authenticate);

// The front desk bills packages, so reading one rides on the same read-only
// MASTER_VIEW a receptionist already holds; changing one is Admin work.
router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), PackageController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.MASTER_VIEW), PackageController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.TEST_MANAGE),
  validateRequest(createPackageSchema),
  PackageController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.TEST_MANAGE),
  validateRequest(updatePackageSchema),
  PackageController.update
);
router.patch('/:id/status', requirePermission(PERMISSIONS.TEST_MANAGE), PackageController.toggleStatus);
router.delete('/:id', requirePermission(PERMISSIONS.TEST_MANAGE), PackageController.remove);

export default router;
