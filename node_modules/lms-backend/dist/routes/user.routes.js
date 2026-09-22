"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_validator_1 = require("../validators/auth.validator");
const permissions_1 = require("../constants/permissions");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Staff accounts are the Admin's alone - creating a login is how someone gets
// into the centre's records at all.
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), user_controller_1.UserController.getAllUsers);
// Literal segment before '/:id' so "collectors" is not read as an ObjectId.
// The front desk needs this list to assign a home visit, nothing more.
router.get('/collectors', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.APPOINTMENT_MANAGE, permissions_1.PERMISSIONS.SAMPLE_VIEW), user_controller_1.UserController.getCollectors);
router.post('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), (0, validate_middleware_1.validateRequest)(auth_validator_1.createUserSchema), user_controller_1.UserController.createUser);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), user_controller_1.UserController.getUserById);
router.put('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), (0, validate_middleware_1.validateRequest)(auth_validator_1.updateUserSchema), user_controller_1.UserController.updateUser);
// Setting someone else's password, for the member who is locked out and so
// cannot use the self-service change that asks for the old one.
router.patch('/:id/password', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), (0, validate_middleware_1.validateRequest)(auth_validator_1.resetPasswordSchema), user_controller_1.UserController.resetPassword);
router.patch('/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.STAFF_MANAGE), user_controller_1.UserController.toggleStatus);
exports.default = router;
