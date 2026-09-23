"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("../controllers/billing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const billing_validator_1 = require("../validators/billing.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), billing_controller_1.BillingController.getAll);
// Literal segments must precede '/:id', otherwise "barcode" is parsed as an
// ObjectId and the lookup fails with a CastError.
router.get('/barcode/:barcode', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), billing_controller_1.BillingController.getByBarcode);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), billing_controller_1.BillingController.getById);
// The whole front-desk intake in one call: register-or-reuse the patient,
// raise the bill, queue the samples.
router.post('/visit', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_CREATE), (0, validate_middleware_1.validateRequest)(billing_validator_1.createVisitSchema), billing_controller_1.BillingController.createVisit);
router.post('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_CREATE), (0, validate_middleware_1.validateRequest)(billing_validator_1.createInvoiceSchema), billing_controller_1.BillingController.createInvoice);
// Changing a bill already raised: another test on the same visit, or the
// concession the patient was promised before they came in to settle. The desk
// that may raise a bill may revise one - the discount ceiling still applies.
router.put('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_CREATE), (0, validate_middleware_1.validateRequest)(billing_validator_1.reviseInvoiceSchema), billing_controller_1.BillingController.reviseInvoice);
router.post('/:id/payments', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_COLLECT_PAYMENT), (0, validate_middleware_1.validateRequest)(billing_validator_1.addPaymentSchema), billing_controller_1.BillingController.addPayment);
exports.default = router;
