"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePayoutStatusSchema = exports.createPayoutSchema = exports.createRefundSchema = void 0;
const zod_1 = require("zod");
const expense_interface_1 = require("../types/expense.interface");
const paymentMethod = zod_1.z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online']);
exports.createRefundSchema = zod_1.z.object({
    body: zod_1.z.object({
        invoiceId: zod_1.z.string().min(1, 'Invoice ID is required'),
        refundAmount: zod_1.z.number().gt(0, 'Refund amount must be greater than zero'),
        reason: zod_1.z.string().min(2, 'Reason for refund is required'),
        paymentMethod,
        remarks: zod_1.z.string().optional(),
    }),
});
exports.createPayoutSchema = zod_1.z.object({
    body: zod_1.z.object({
        payeeType: zod_1.z.enum(expense_interface_1.PAYEE_TYPES),
        payeeName: zod_1.z.string().min(2, 'Name of the person or vendor being paid is required'),
        payeeContact: zod_1.z.string().optional(),
        description: zod_1.z.string().min(2, 'A short note on what this payment is for is required'),
        amount: zod_1.z.number().gt(0, 'Amount must be greater than zero'),
        paymentMethod,
        referenceNo: zod_1.z.string().optional(),
        expenseDate: zod_1.z.string().optional(),
        patientId: zod_1.z.string().optional(),
        invoiceId: zod_1.z.string().optional(),
        doctorId: zod_1.z.string().optional(),
        receiptUrl: zod_1.z.string().optional(),
    }),
});
exports.updatePayoutStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['Paid', 'Rejected']),
        rejectionReason: zod_1.z.string().optional(),
    }),
});
