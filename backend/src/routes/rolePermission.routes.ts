import { Router } from 'express';
import { RolePermissionController } from '../controllers/rolePermission.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// The permission list and each role's defaults, for the staff form. Read-only:
// access is granted per account, on the staff screen.
router.get('/', requirePermission(PERMISSIONS.STAFF_MANAGE), RolePermissionController.getMatrix);

export default router;
