import { Router } from 'express';
import { AccountsController } from '../controllers/accounts.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import {
  createRefundSchema,
  createPayoutSchema,
  updatePayoutStatusSchema,
} from '../validators/accounts.validator';

const router = Router();

router.use(authenticate);

router.get('/collections/daily', requirePermission(PERMISSIONS.BILL_VIEW), AccountsController.getDailyCollections);
// The same money, day by day, for the desk and the dashboard.
router.get('/collections/trend', requirePermission(PERMISSIONS.BILL_VIEW), AccountsController.getCollectionTrend);
// Everything ever taken, with no window around it - what the owner asks for
// once the day and the week have been answered.
router.get(
  '/collections/overall',
  requirePermission(PERMISSIONS.BILL_VIEW),
  AccountsController.getOverallCollections
);

router.get('/refunds', requirePermission(PERMISSIONS.REFUND_VIEW), AccountsController.getAllRefunds);
router.post(
  '/refunds',
  requirePermission(PERMISSIONS.REFUND_ISSUE),
  validateRequest(createRefundSchema),
  AccountsController.createRefund
);

// Money going out: the ambulance, the courier, a doctor cut. Literal segments
// precede '/:id' so "summary" is not parsed as an ObjectId.
router.get('/payouts/summary', requirePermission(PERMISSIONS.PAYOUT_VIEW), AccountsController.getPayoutSummary);
router.get('/payouts', requirePermission(PERMISSIONS.PAYOUT_VIEW), AccountsController.getAllPayouts);
router.post(
  '/payouts',
  requirePermission(PERMISSIONS.PAYOUT_CREATE),
  validateRequest(createPayoutSchema),
  AccountsController.createPayout
);
router.patch(
  '/payouts/:id/status',
  requirePermission(PERMISSIONS.PAYOUT_APPROVE),
  validateRequest(updatePayoutStatusSchema),
  AccountsController.updatePayoutStatus
);
router.delete('/payouts/:id', requirePermission(PERMISSIONS.PAYOUT_DELETE), AccountsController.deletePayout);

// Retained so any client still pointed at /expenses keeps resolving.
router.get('/expenses', requirePermission(PERMISSIONS.PAYOUT_VIEW), AccountsController.getAllPayouts);
router.post(
  '/expenses',
  requirePermission(PERMISSIONS.PAYOUT_CREATE),
  validateRequest(createPayoutSchema),
  AccountsController.createPayout
);

router.get(
  '/doctor-commissions',
  requirePermission(PERMISSIONS.REPORT_VIEW),
  AccountsController.getDoctorCommissionReport
);

export default router;
