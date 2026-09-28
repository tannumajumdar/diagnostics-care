import { Router } from 'express';
import { SavedReportController } from '../controllers/savedReport.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// The same desks that may pull a report PDF may save one and find it again.
const canReadReports = requirePermission(PERMISSIONS.RESULT_VIEW, PERMISSIONS.BILL_VIEW);

router.get('/', canReadReports, SavedReportController.list);
router.post('/from-result/:resultId', canReadReports, SavedReportController.save);
router.get('/:id/file', canReadReports, SavedReportController.file);

export default router;
