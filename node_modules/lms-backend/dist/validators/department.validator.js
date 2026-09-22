"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepartmentSchema = exports.createDepartmentSchema = void 0;
const zod_1 = require("zod");
exports.createDepartmentSchema = zod_1.z.object({
    departmentName: zod_1.z.string().min(2, 'Department name is required'),
    departmentCode: zod_1.z.string().min(2, 'Department code is required'),
    description: zod_1.z.string().optional(),
});
exports.updateDepartmentSchema = exports.createDepartmentSchema.partial();
