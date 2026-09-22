import { z } from 'zod';
import { PAYEE_TYPES } from '../types/expense.interface';
import { DISBURSEMENT_METHOD_VALUES } from '../constants/payment-methods';

const paymentMethod = z.enum(DISBURSEMENT_METHOD_VALUES);

export const createRefundSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
    refundAmount: z.number().gt(0, 'Refund amount must be greater than zero'),
    reason: z.string().min(2, 'Reason for refund is required'),
    paymentMethod,
    remarks: z.string().optional(),
  }),
});

export const createPayoutSchema = z.object({
  body: z.object({
    payeeType: z.enum(PAYEE_TYPES),
    payeeName: z.string().min(2, 'Name of the person or vendor being paid is required'),
    payeeContact: z.string().optional(),
    description: z.string().min(2, 'A short note on what this payment is for is required'),
    amount: z.number().gt(0, 'Amount must be greater than zero'),
    paymentMethod,
    referenceNo: z.string().optional(),
    expenseDate: z.string().optional(),
    patientId: z.string().optional(),
    invoiceId: z.string().optional(),
    doctorId: z.string().optional(),
    receiptUrl: z.string().optional(),
  }),
});

export const updatePayoutStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Paid', 'Rejected']),
    rejectionReason: z.string().optional(),
  }),
});
