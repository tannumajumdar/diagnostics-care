"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAppointmentStatusSchema = exports.assignPhlebotomistSchema = exports.createAppointmentSchema = void 0;
const zod_1 = require("zod");
exports.createAppointmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        patientId: zod_1.z.string().optional(),
        patientName: zod_1.z.string().min(2, 'Patient name required'),
        mobile: zod_1.z.string().min(10, 'Valid 10-digit mobile number required'),
        doctorId: zod_1.z.string().optional(),
        testIds: zod_1.z.array(zod_1.z.string()).optional(),
        date: zod_1.z.string().min(1, 'Date is required'),
        time: zod_1.z.string().min(1, 'Time slot is required'),
        collectionType: zod_1.z.enum(['Lab Visit', 'Home Collection']),
        address: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.assignPhlebotomistSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().min(1, 'Phlebotomist user ID required'),
        name: zod_1.z.string().min(1, 'Phlebotomist name required'),
        mobile: zod_1.z.string().optional(),
    }),
});
exports.updateAppointmentStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum([
            'Pending',
            'Confirmed',
            'Assigned',
            'On The Way',
            'Collected',
            'Submitted',
            'Completed',
            'Cancelled',
        ]),
        notes: zod_1.z.string().optional(),
    }),
});
