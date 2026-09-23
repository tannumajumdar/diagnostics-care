"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectSampleSchema = exports.updateSampleStatusSchema = void 0;
const zod_1 = require("zod");
exports.updateSampleStatusSchema = zod_1.z.object({
    status: zod_1.z.enum([
        'Registered',
        'Pending Collection',
        'Collected',
        'Received',
        'Processing',
        'Completed',
        'Rejected',
        'Recollected',
        'Cancelled',
    ]),
    rejectionReason: zod_1.z.string().optional(),
    remarks: zod_1.z.string().optional(),
    collector: zod_1.z.string().optional(),
});
exports.rejectSampleSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().min(1, 'Rejection reason is required'),
    rejectionRemarks: zod_1.z.string().optional(),
    remarks: zod_1.z.string().optional(),
});
