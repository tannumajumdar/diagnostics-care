import { z } from 'zod';

export const initiateTransactionSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.number().gt(0, 'Amount must be greater than zero'),
  // Only the two methods that go through a machine. Cash needs no gateway,
  // and a cheque or a bank transfer is settled outside this flow entirely.
  method: z.enum(['UPI', 'Card']),
  vpa: z
    .string()
    .trim()
    .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'That does not look like a UPI id')
    .optional()
    .or(z.literal('')),
});

export const simulateTransactionSchema = z.object({
  /** Stands in for a provider's webhook signature. */
  token: z.string().min(16, 'Missing payer token'),
  outcome: z.enum(['success', 'failure']),
  reason: z.string().max(200).optional(),
  cardLast4: z.string().regex(/^\d{4}$/, 'Card last 4 must be four digits').optional(),
  cardNetwork: z.enum(['RuPay', 'Visa', 'Mastercard', 'Amex']).optional(),
  vpa: z.string().trim().optional(),
});
