"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_controller_1 = require("../controllers/patient.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const patient_validator_1 = require("../validators/patient.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_VIEW), patient_controller_1.PatientController.getAll);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_VIEW), patient_controller_1.PatientController.getById);
// Pulling up an older patient: past visits, bills, samples and reports.
router.get('/:id/history', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_HISTORY), patient_controller_1.PatientController.getHistory);
router.post('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_CREATE), (0, validate_middleware_1.validateRequest)(patient_validator_1.createPatientSchema), patient_controller_1.PatientController.create);
router.put('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_EDIT), (0, validate_middleware_1.validateRequest)(patient_validator_1.updatePatientSchema), patient_controller_1.PatientController.update);
router.patch('/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.PATIENT_EDIT), patient_controller_1.PatientController.toggleStatus);
exports.default = router;
