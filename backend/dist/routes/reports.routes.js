"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("../controllers/reports.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Analytics are a management view - the front desk works off its own day
// screens rather than centre-wide revenue.
router.use((0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.REPORT_VIEW));
router.get('/revenue/daily', reports_controller_1.ReportsController.getDailyRevenue);
router.get('/revenue/monthly', reports_controller_1.ReportsController.getMonthlyRevenue);
router.get('/patients/trend', reports_controller_1.ReportsController.getPatientRegistrations);
router.get('/tests/revenue', reports_controller_1.ReportsController.getTestWiseRevenue);
router.get('/departments/tests', reports_controller_1.ReportsController.getDepartmentWiseTests);
router.get('/doctors/tests', reports_controller_1.ReportsController.getDoctorWiseTests);
router.get('/payments/methods', reports_controller_1.ReportsController.getPaymentMethods);
router.get('/payments/pending', reports_controller_1.ReportsController.getPendingDuePayments);
router.get('/reports/completion', reports_controller_1.ReportsController.getReportCompletionStats);
router.get('/samples/rejections', reports_controller_1.ReportsController.getSampleRejectionAnalytics);
router.get('/corporate/revenue', reports_controller_1.ReportsController.getCorporateRevenue);
exports.default = router;
