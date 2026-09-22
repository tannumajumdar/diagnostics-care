"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const package_controller_1 = require("../controllers/package.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const permissions_1 = require("../constants/permissions");
const package_validator_1 = require("../validators/package.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// The front desk bills packages, so reading one rides on the same read-only
// MASTER_VIEW a receptionist already holds; changing one is Admin work.
router.get('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.MASTER_VIEW), package_controller_1.PackageController.getAll);
router.get('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.MASTER_VIEW), package_controller_1.PackageController.getById);
router.post('/', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.TEST_MANAGE), (0, validate_middleware_1.validateRequest)(package_validator_1.createPackageSchema), package_controller_1.PackageController.create);
router.put('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.TEST_MANAGE), (0, validate_middleware_1.validateRequest)(package_validator_1.updatePackageSchema), package_controller_1.PackageController.update);
router.patch('/:id/status', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.TEST_MANAGE), package_controller_1.PackageController.toggleStatus);
router.delete('/:id', (0, auth_middleware_1.requirePermission)(permissions_1.PERMISSIONS.TEST_MANAGE), package_controller_1.PackageController.remove);
exports.default = router;
