"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentGateway_controller_1 = require("../controllers/paymentGateway.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const paymentGateway_validator_1 = require("../validators/paymentGateway.validator");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
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
router.post('/:txnId/simulate', (0, validate_middleware_1.validateRequest)(paymentGateway_validator_1.simulateTransactionSchema), paymentGateway_controller_1.PaymentGatewayController.simulate);
// Everything below is the desk, and needs a staff session.
router.use(auth_middleware_1.authenticate);
// Taking money through a machine is the same permission as taking it by hand.
router.post('/initiate', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_COLLECT_PAYMENT), (0, validate_middleware_1.validateRequest)(paymentGateway_validator_1.initiateTransactionSchema), paymentGateway_controller_1.PaymentGatewayController.initiate);
router.get('/invoice/:invoiceId', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), paymentGateway_controller_1.PaymentGatewayController.listForInvoice);
router.get('/:txnId', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), paymentGateway_controller_1.PaymentGatewayController.getStatus);
router.post('/:txnId/cancel', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_COLLECT_PAYMENT), paymentGateway_controller_1.PaymentGatewayController.cancel);
exports.default = router;
