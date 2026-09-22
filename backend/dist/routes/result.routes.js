"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const result_controller_1 = require("../controllers/result.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const result_validator_1 = require("../validators/result.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VIEW), result_controller_1.ResultController.getAll);
router.get('/pending', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VERIFY), result_controller_1.ResultController.getPendingVerification);
router.get('/sample/:sampleId', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VIEW), result_controller_1.ResultController.getBySampleId);
// The whole visit's sheets in one call, so the bench types every test the
// patient was billed for without walking back to the queue between them.
router.get('/visit/:sampleId', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VIEW), result_controller_1.ResultController.getVisitBySampleId);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VIEW), result_controller_1.ResultController.getById);
// The front desk hands the printed report to the patient, so any desk that can
// see a bill may pull the released PDF.
router.get('/:id/pdf', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VIEW, permissions_1.PERMISSIONS.BILL_VIEW), result_controller_1.ResultController.downloadPDF);
router.post('/draft', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_ENTER), (0, validate_middleware_1.validateRequest)(result_validator_1.saveResultSchema), result_controller_1.ResultController.saveDraft);
router.post('/submit', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_ENTER), (0, validate_middleware_1.validateRequest)(result_validator_1.saveResultSchema), result_controller_1.ResultController.submitResult);
router.patch('/:id/verify', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.RESULT_VERIFY), (0, validate_middleware_1.validateRequest)(result_validator_1.verifyResultSchema), result_controller_1.ResultController.verifyResult);
exports.default = router;
