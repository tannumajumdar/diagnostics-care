"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accounts_controller_1 = require("../controllers/accounts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const accounts_validator_1 = require("../validators/accounts.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/collections/daily', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), accounts_controller_1.AccountsController.getDailyCollections);
// The same money, day by day, for the desk and the dashboard.
router.get('/collections/trend', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), accounts_controller_1.AccountsController.getCollectionTrend);
// Everything ever taken, with no window around it - what the owner asks for
// once the day and the week have been answered.
router.get('/collections/overall', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), accounts_controller_1.AccountsController.getOverallCollections);
// Unified Patient Ledger & Cash Flow
router.get('/ledger', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.BILL_VIEW), accounts_controller_1.AccountsController.getLedger);
router.get('/refunds', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REFUND_VIEW), accounts_controller_1.AccountsController.getAllRefunds);
router.post('/refunds', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REFUND_ISSUE), (0, validate_middleware_1.validateRequest)(accounts_validator_1.createRefundSchema), accounts_controller_1.AccountsController.createRefund);
// Money going out: the ambulance, the courier, a doctor cut. Literal segments
// precede '/:id' so "summary" is not parsed as an ObjectId.
router.get('/payouts/summary', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_VIEW), accounts_controller_1.AccountsController.getPayoutSummary);
router.get('/payouts', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_VIEW), accounts_controller_1.AccountsController.getAllPayouts);
router.post('/payouts', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_CREATE), (0, validate_middleware_1.validateRequest)(accounts_validator_1.createPayoutSchema), accounts_controller_1.AccountsController.createPayout);
router.patch('/payouts/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_APPROVE), (0, validate_middleware_1.validateRequest)(accounts_validator_1.updatePayoutStatusSchema), accounts_controller_1.AccountsController.updatePayoutStatus);
router.delete('/payouts/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_DELETE), accounts_controller_1.AccountsController.deletePayout);
// Retained so any client still pointed at /expenses keeps resolving.
router.get('/expenses', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_VIEW), accounts_controller_1.AccountsController.getAllPayouts);
router.post('/expenses', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PAYOUT_CREATE), (0, validate_middleware_1.validateRequest)(accounts_validator_1.createPayoutSchema), accounts_controller_1.AccountsController.createPayout);
router.get('/doctor-commissions', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REPORT_VIEW), accounts_controller_1.AccountsController.getDoctorCommissionReport);
exports.default = router;
