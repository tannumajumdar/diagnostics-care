import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);
// Analytics are a management view - the front desk works off its own day
// screens rather than centre-wide revenue.
router.use(requirePermission(PERMISSIONS.REPORT_VIEW));

router.get('/revenue/daily', ReportsController.getDailyRevenue);
router.get('/revenue/monthly', ReportsController.getMonthlyRevenue);
router.get('/patients/trend', ReportsController.getPatientRegistrations);
router.get('/tests/revenue', ReportsController.getTestWiseRevenue);
router.get('/departments/tests', ReportsController.getDepartmentWiseTests);
router.get('/doctors/tests', ReportsController.getDoctorWiseTests);
router.get('/payments/methods', ReportsController.getPaymentMethods);
router.get('/payments/pending', ReportsController.getPendingDuePayments);
router.get('/reports/completion', ReportsController.getReportCompletionStats);
router.get('/samples/rejections', ReportsController.getSampleRejectionAnalytics);
router.get('/corporate/revenue', ReportsController.getCorporateRevenue);

export default router;
