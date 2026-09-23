"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const refundPolicy_controller_1 = require("../controllers/refundPolicy.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const refundPolicy_validator_1 = require("../validators/refundPolicy.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// The counter has to be able to read the policy to quote it to a patient;
// only an Admin writes it.
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.MASTER_VIEW), refundPolicy_controller_1.RefundPolicyController.getPolicy);
router.put('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REFUND_POLICY_MANAGE), (0, validate_middleware_1.validateRequest)(refundPolicy_validator_1.updateRefundPolicySchema), refundPolicy_controller_1.RefundPolicyController.updatePolicy);
// What a bill's lines are worth back today, and the cancellation itself.
router.get('/quote/:invoiceId', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REFUND_VIEW), refundPolicy_controller_1.RefundPolicyController.getQuote);
router.post('/cancel-tests', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REFUND_ISSUE), (0, validate_middleware_1.validateRequest)(refundPolicy_validator_1.cancelTestsSchema), refundPolicy_controller_1.RefundPolicyController.cancelTests);
exports.default = router;
