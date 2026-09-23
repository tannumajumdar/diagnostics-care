import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import {
  createInvoiceSchema,
  createVisitSchema,
  addPaymentSchema,
  reviseInvoiceSchema,
} from '../validators/billing.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.BILL_VIEW), BillingController.getAll);
// Literal segments must precede '/:id', otherwise "barcode" is parsed as an
// ObjectId and the lookup fails with a CastError.
router.get('/barcode/:barcode', requirePermission(PERMISSIONS.BILL_VIEW), BillingController.getByBarcode);
router.get('/:id', requirePermission(PERMISSIONS.BILL_VIEW), BillingController.getById);

// The whole front-desk intake in one call: register-or-reuse the patient,
// raise the bill, queue the samples.
router.post(
  '/visit',
  requirePermission(PERMISSIONS.BILL_CREATE),
  validateRequest(createVisitSchema),
  BillingController.createVisit
);
router.post(
  '/',
  requirePermission(PERMISSIONS.BILL_CREATE),
  validateRequest(createInvoiceSchema),
  BillingController.createInvoice
);
// Changing a bill already raised: another test on the same visit, or the
// concession the patient was promised before they came in to settle. The desk
// that may raise a bill may revise one - the discount ceiling still applies.
router.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_CREATE),
  validateRequest(reviseInvoiceSchema),
  BillingController.reviseInvoice
);

router.post(
  '/:id/payments',
  requirePermission(PERMISSIONS.BILL_COLLECT_PAYMENT),
  validateRequest(addPaymentSchema),
  BillingController.addPayment
);

export default router;
