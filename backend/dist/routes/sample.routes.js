"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sample_controller_1 = require("../controllers/sample.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const sample_validator_1 = require("../validators/sample.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_VIEW), sample_controller_1.SampleController.getAll);
router.get('/stats', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_VIEW), sample_controller_1.SampleController.getDashboardStats);
router.get('/barcode/:barcode', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_VIEW), sample_controller_1.SampleController.getByBarcode);
router.get('/:id/timeline', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_VIEW), sample_controller_1.SampleController.getTimeline);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_VIEW), sample_controller_1.SampleController.getById);
// The stage a sample may be moved into is enforced per role inside the
// service; this only gates who may touch the bench at all.
router.patch('/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_COLLECT, permissions_1.PERMISSIONS.SAMPLE_PROCESS), (0, validate_middleware_1.validateRequest)(sample_validator_1.updateSampleStatusSchema), sample_controller_1.SampleController.updateStatus);
router.patch('/:id/reject', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_REJECT), (0, validate_middleware_1.validateRequest)(sample_validator_1.rejectSampleSchema), sample_controller_1.SampleController.rejectSample);
router.patch('/:id/recollect', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.SAMPLE_REJECT), sample_controller_1.SampleController.recollectSample);
exports.default = router;
