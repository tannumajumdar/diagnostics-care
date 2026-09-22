"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientSchema = exports.createPatientSchema = void 0;
const zod_1 = require("zod");
exports.createPatientSchema = zod_1.z.object({
    patientName: zod_1.z.string().min(2, 'Patient name is required'),
    gender: zod_1.z.enum(['Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child']),
    age: zod_1.z.number().min(0, 'Age must be non-negative'),
    mobile: zod_1.z.string().min(10, 'Valid mobile is required'),
});
exports.updatePatientSchema = exports.createPatientSchema.partial();
