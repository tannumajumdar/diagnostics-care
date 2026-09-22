"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDoctorSchema = exports.createDoctorSchema = void 0;
const zod_1 = require("zod");
exports.createDoctorSchema = zod_1.z.object({
    doctorName: zod_1.z.string().min(2, 'Doctor name is required'),
    department: zod_1.z.string().min(1, 'Department is required'),
    mobile: zod_1.z.string().min(10, 'Valid mobile number is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
});
exports.updateDoctorSchema = exports.createDoctorSchema.partial();
