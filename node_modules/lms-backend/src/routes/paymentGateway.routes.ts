import { Router } from 'express';
import { PaymentGatewayController } from '../controllers/paymentGateway.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { initiateTransactionSchema, simulateTransactionSchema } from '../validators/paymentGateway.validator';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

/**
 * The payer's side of the counter, and the only endpoint here that a real
 * deployment removes.
 *
 * With a live provider the outcome arrives as a signed webhook from the bank,
 * or as a reply from the card terminal - never from a member of staff. So this
 * sits deliberately OUTSIDE the staff session: the person paying does not have
 * a login, and letting the desk's own token resolve the desk's own request
 * would collapse the two sides this design exists to keep apart.
 *
 * What stands in for the provider's signature is the transaction's payerToken,
 * which is random and is checked below. Without it, transaction ids running in
 * sequence would mean guessing one was enough to mark a stranger's collection
 * as paid.
 */
router.post('/:txnId/simulate', validateRequest(simulateTransactionSchema), PaymentGatewayController.simulate);

// Everything below is the desk, and needs a staff session.
router.use(authenticate);

// Taking money through a machine is the same permission as taking it by hand.
router.post(
  '/initiate',
  requirePermission(PERMISSIONS.BILL_COLLECT_PAYMENT),
  validateRequest(initiateTransactionSchema),
  PaymentGatewayController.initiate
);

router.get('/invoice/:invoiceId', requirePermission(PERMISSIONS.BILL_VIEW), PaymentGatewayController.listForInvoice);
router.get('/:txnId', requirePermission(PERMISSIONS.BILL_VIEW), PaymentGatewayController.getStatus);
router.post('/:txnId/cancel', requirePermission(PERMISSIONS.BILL_COLLECT_PAYMENT), PaymentGatewayController.cancel);

export default router;
