"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePackageSchema = exports.createPackageSchema = void 0;
const zod_1 = require("zod");
/**
 * What the package master screen sends. The tests are ids from the catalogue;
 * a panel with nothing in it would bill a price against no work, so at least
 * one is required.
 */
exports.createPackageSchema = zod_1.z.object({
    packageName: zod_1.z.string().min(2, 'Package name is required'),
    packageCode: zod_1.z.string().min(2, 'Package code is required'),
    description: zod_1.z.string().optional(),
    tests: zod_1.z.array(zod_1.z.string().min(1)).min(1, 'Add at least one test to the package'),
    rate: zod_1.z.number().min(0, 'Package rate must be positive'),
    referralRate: zod_1.z.number().min(0).optional(),
    discountAllowed: zod_1.z.boolean().optional(),
    status: zod_1.z.string().optional(),
});
exports.updatePackageSchema = exports.createPackageSchema.partial();
