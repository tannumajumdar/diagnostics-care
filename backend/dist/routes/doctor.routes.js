"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctor_controller_1 = require("../controllers/doctor.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const doctor_validator_1 = require("../validators/doctor.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// The front desk must be able to pick a referring doctor while billing, so
// reading the panel is open to any desk that sees the masters. Adding or
// editing a doctor is an Admin action.
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.MASTER_VIEW), doctor_controller_1.DoctorController.getAll);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.MASTER_VIEW), doctor_controller_1.DoctorController.getById);
router.post('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.DOCTOR_MANAGE), (0, validate_middleware_1.validateRequest)(doctor_validator_1.createDoctorSchema), doctor_controller_1.DoctorController.create);
router.put('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.DOCTOR_MANAGE), (0, validate_middleware_1.validateRequest)(doctor_validator_1.updateDoctorSchema), doctor_controller_1.DoctorController.update);
router.patch('/bulk/cut-value', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.DOCTOR_MANAGE), doctor_controller_1.DoctorController.setCutValue);
router.patch('/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.DOCTOR_MANAGE), doctor_controller_1.DoctorController.toggleStatus);
exports.default = router;
