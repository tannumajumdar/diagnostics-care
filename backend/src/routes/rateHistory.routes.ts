import { Router } from 'express';
import { RateHistoryController } from '../controllers/rateHistory.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.RATE_MANAGE), RateHistoryController.getAll);
router.get('/test/:testId', requirePermission(PERMISSIONS.RATE_MANAGE), RateHistoryController.getByTestId);

export default router;
