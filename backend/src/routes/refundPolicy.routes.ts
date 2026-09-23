import { Router } from 'express';
import { RefundPolicyController } from '../controllers/refundPolicy.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { updateRefundPolicySchema, cancelTestsSchema } from '../validators/refundPolicy.validator';

const router = Router();

router.use(authenticate);

// The counter has to be able to read the policy to quote it to a patient;
// only an Admin writes it.
router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), RefundPolicyController.getPolicy);
router.put(
  '/',
  requirePermission(PERMISSIONS.REFUND_POLICY_MANAGE),
  validateRequest(updateRefundPolicySchema),
  RefundPolicyController.updatePolicy
);

// What a bill's lines are worth back today, and the cancellation itself.
router.get('/quote/:invoiceId', requirePermission(PERMISSIONS.REFUND_VIEW), RefundPolicyController.getQuote);
router.post(
  '/cancel-tests',
  requirePermission(PERMISSIONS.REFUND_ISSUE),
  validateRequest(cancelTestsSchema),
  RefundPolicyController.cancelTests
);

export default router;
