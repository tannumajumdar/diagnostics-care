"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateTransactionSchema = exports.initiateTransactionSchema = void 0;
const zod_1 = require("zod");
exports.initiateTransactionSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().min(1, 'Invoice is required'),
    amount: zod_1.z.number().gt(0, 'Amount must be greater than zero'),
    // Only the two methods that go through a machine. Cash needs no gateway,
    // and a cheque or a bank transfer is settled outside this flow entirely.
    method: zod_1.z.enum(['UPI', 'Card']),
    vpa: zod_1.z
        .string()
        .trim()
        .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'That does not look like a UPI id')
        .optional()
        .or(zod_1.z.literal('')),
});
exports.simulateTransactionSchema = zod_1.z.object({
    /** Stands in for a provider's webhook signature. */
    token: zod_1.z.string().min(16, 'Missing payer token'),
    outcome: zod_1.z.enum(['success', 'failure']),
    reason: zod_1.z.string().max(200).optional(),
    cardLast4: zod_1.z.string().regex(/^\d{4}$/, 'Card last 4 must be four digits').optional(),
    cardNetwork: zod_1.z.enum(['RuPay', 'Visa', 'Mastercard', 'Amex']).optional(),
    vpa: zod_1.z.string().trim().optional(),
});
