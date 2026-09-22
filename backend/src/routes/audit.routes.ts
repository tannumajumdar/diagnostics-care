import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission(PERMISSIONS.AUDIT_VIEW), getAuditLogs);

export default router;
