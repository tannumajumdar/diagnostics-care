import { Router } from 'express';
import { RolePermissionController } from '../controllers/rolePermission.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// Who may do what is a staff question, so it sits behind the same permission
// as the staff accounts themselves.
router.get('/', requirePermission(PERMISSIONS.STAFF_MANAGE), RolePermissionController.getMatrix);
router.put('/:role', requirePermission(PERMISSIONS.STAFF_MANAGE), RolePermissionController.updateRole);
router.delete('/:role', requirePermission(PERMISSIONS.STAFF_MANAGE), RolePermissionController.resetRole);

export default router;
