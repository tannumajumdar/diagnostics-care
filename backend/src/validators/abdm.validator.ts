import { z } from 'zod';

const txnId = z.string().trim().min(1, 'txnId is required');
const otp = z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits');
const mobile = z
  .string()
  .transform((v) => v.replace(/\D/g, '').slice(-10))
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile');
const abhaNumber = z
  .string()
  .refine((v) => /^\d{14}$/.test(v.replace(/[\s-]/g, '')), 'ABHA number must be 14 digits');

const method = z.enum(['abha-aadhaar-otp', 'abha-mobile-otp', 'mobile-otp']);

export const loginOtpSchema = z
  .object({ method, value: z.string().trim().min(1, 'Enter the ABHA number or mobile') })
  .superRefine((data, ctx) => {
    const ok =
      data.method === 'mobile-otp'
        ? /^[6-9]\d{9}$/.test(data.value.replace(/\D/g, '').slice(-10))
        : /^\d{14}$/.test(data.value.replace(/[\s-]/g, ''));
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: data.method === 'mobile-otp' ? 'Enter a valid 10-digit mobile' : 'ABHA number must be 14 digits',
      });
    }
  });

export const loginVerifySchema = z.object({ method, txnId, otp });

export const loginPickSchema = z.object({ txnId, abhaNumber });

export const enrolOtpSchema = z.object({
  aadhaar: z.string().refine((v) => /^\d{12}$/.test(v.replace(/\s/g, '')), 'Aadhaar number must be 12 digits'),
});

export const enrolVerifySchema = z.object({ txnId, otp, mobile });

export const enrolMobileOtpSchema = z.object({ txnId, mobile });

export const enrolMobileVerifySchema = z.object({ txnId, otp });

export const enrolAddressSchema = z.object({
  txnId,
  abhaAddress: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => /^[a-z0-9][a-z0-9._]{7,17}$/.test(v.replace(/@.*$/, '')),
      'ABHA address must be 8 to 18 letters, digits, dots or underscores'
    ),
});

export const enrolTxnSchema = z.object({ txnId });
