"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const department_routes_1 = __importDefault(require("./department.routes"));
const doctor_routes_1 = __importDefault(require("./doctor.routes"));
const test_routes_1 = __importDefault(require("./test.routes"));
const package_routes_1 = __importDefault(require("./package.routes"));
const rateHistory_routes_1 = __importDefault(require("./rateHistory.routes"));
const organization_routes_1 = __importDefault(require("./organization.routes"));
const patient_routes_1 = __importDefault(require("./patient.routes"));
const billing_routes_1 = __importDefault(require("./billing.routes"));
const paymentGateway_routes_1 = __importDefault(require("./paymentGateway.routes"));
const sample_routes_1 = __importDefault(require("./sample.routes"));
const result_routes_1 = __importDefault(require("./result.routes"));
const appointment_routes_1 = __importDefault(require("./appointment.routes"));
const accounts_routes_1 = __importDefault(require("./accounts.routes"));
const refundPolicy_routes_1 = __importDefault(require("./refundPolicy.routes"));
const reports_routes_1 = __importDefault(require("./reports.routes"));
const audit_routes_1 = __importDefault(require("./audit.routes"));
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'Laboratory Management System API is healthy',
        timestamp: new Date().toISOString(),
    });
});
router.use('/auth', auth_routes_1.default);
router.use('/users', user_routes_1.default);
router.use('/departments', department_routes_1.default);
router.use('/doctors', doctor_routes_1.default);
router.use('/tests', test_routes_1.default);
router.use('/packages', package_routes_1.default);
router.use('/rate-history', rateHistory_routes_1.default);
router.use('/organizations', organization_routes_1.default);
router.use('/patients', patient_routes_1.default);
router.use('/billing', billing_routes_1.default);
// UPI and card collections, which are an attempt before they are a payment.
router.use('/payment-gateway', paymentGateway_routes_1.default);
router.use('/samples', sample_routes_1.default);
router.use('/results', result_routes_1.default);
router.use('/appointments', appointment_routes_1.default);
router.use('/accounts', accounts_routes_1.default);
// The centre's return policy, and cancelling a test against it.
router.use('/refund-policy', refundPolicy_routes_1.default);
router.use('/reports', reports_routes_1.default);
router.use('/audit-logs', audit_routes_1.default);
exports.default = router;
