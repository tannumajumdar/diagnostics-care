import { PrismaClient } from '@prisma/client';

/**
 * The one Prisma client the app shares.
 *
 * The columns Mongoose kept out of every query with `select: false` are
 * omitted here the same way - the bytes of a PDF or an attachment, the
 * payer's secret, a password hash, a refresh token. A query that needs one
 * asks for it with `omit: { field: false }`, the counterpart of Mongoose's
 * `.select('+field')`.
 */
export const OMITTED: Record<string, Record<string, true>> = {
  user: { password: true, refreshToken: true },
  paymentTransaction: { payerToken: true },
  savedReport: { data: true },
  testAttachment: { data: true },
};

export const prisma = new PrismaClient({ omit: OMITTED as any });

export type Tx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** DATABASE_URL with its password masked, for a "connected to" line in a log. */
export const describeDatabase = (url = process.env.DATABASE_URL || '') =>
  url.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:***@');
