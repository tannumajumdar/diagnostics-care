"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResultSchema = exports.saveResultSchema = exports.submitResultSchema = void 0;
const zod_1 = require("zod");
exports.submitResultSchema = zod_1.z.object({
    sampleId: zod_1.z.string().min(1, 'Sample ID is required'),
    results: zod_1.z.array(zod_1.z.object({
        parameterName: zod_1.z.string(),
        value: zod_1.z.string(),
        unit: zod_1.z.string().optional(),
        referenceRange: zod_1.z.string().optional(),
        flag: zod_1.z.enum(['Normal', 'Low', 'High', 'Critical']).optional(),
    })),
});
exports.saveResultSchema = exports.submitResultSchema;
exports.verifyResultSchema = zod_1.z.object({
    action: zod_1.z.enum(['Approve', 'Reject', 'Under Review']),
    rejectionReason: zod_1.z.string().optional(),
});
