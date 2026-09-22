"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRatesSchema = exports.updateLabTestSchema = exports.createLabTestSchema = exports.createTestSchema = void 0;
const zod_1 = require("zod");
/**
 * What the master screen sends when a test is added.
 *
 * The rate tiers are optional here on purpose: the form asks for one standard
 * rate and the controller starts the whole card from it. What is listed as
 * required is what the model refuses to store without, so a missing field is
 * answered with a plain sentence instead of a mongoose validation dump.
 */
exports.createTestSchema = zod_1.z.object({
    testName: zod_1.z.string().min(2, 'Test name is required'),
    testCode: zod_1.z.string().min(2, 'Test code is required'),
    department: zod_1.z.string().min(1, 'Department is required'),
    rate: zod_1.z.number().min(0, 'Rate must be positive'),
    sampleType: zod_1.z.string().optional(),
    sampleContainer: zod_1.z.string().optional(),
    turnaroundTime: zod_1.z.string().optional(),
    testType: zod_1.z.enum(['Routine', 'Special', 'Urgent', 'Profile']).optional(),
    patientRate: zod_1.z.number().min(0).optional(),
    corporateRate: zod_1.z.number().min(0).optional(),
    doctorRate: zod_1.z.number().min(0).optional(),
    emergencyRate: zod_1.z.number().min(0).optional(),
    referralRate: zod_1.z.number().min(0).optional(),
    processingMode: zod_1.z.enum(['In-house', 'Outsource']).optional(),
    outsourceLab: zod_1.z.string().optional(),
    outsourceCost: zod_1.z.number().min(0).optional(),
    discountAllowed: zod_1.z.boolean().optional(),
    fastingRequired: zod_1.z.boolean().optional(),
    preparationRequired: zod_1.z.string().optional(),
    parameters: zod_1.z.array(zod_1.z.any()).optional(),
    status: zod_1.z.string().optional(),
});
exports.createLabTestSchema = exports.createTestSchema;
exports.updateLabTestSchema = exports.createTestSchema.partial();
exports.updateRatesSchema = zod_1.z.object({
    rates: zod_1.z.object({
        rate: zod_1.z.number().optional(),
        patientRate: zod_1.z.number().optional(),
        corporateRate: zod_1.z.number().optional(),
        doctorRate: zod_1.z.number().optional(),
        emergencyRate: zod_1.z.number().optional(),
        referralRate: zod_1.z.number().optional(),
    }),
    reason: zod_1.z.string().optional(),
});
