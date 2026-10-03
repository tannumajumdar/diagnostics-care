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
  // The ABHA photo: tens of kilobytes on a row every bill and sample includes.
  patient: { photo: true },
};

const logSql = process.env.LOG_SQL === 'true';

export const prisma = new PrismaClient({
  omit: OMITTED as any,
  log: logSql ? [{ emit: 'event', level: 'query' }] : [],
});

// LOG_SQL=true in .env prints every query the app runs, with its values, to
// watch what it writes.
if (logSql) {
  (prisma as any).$on('query', (e: { query: string; params: string; duration: number }) => {
    console.log(`[sql ${e.duration}ms] ${e.query}\n  params: ${e.params}`);
  });
}

export type Tx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** DATABASE_URL with its password masked, for a "connected to" line in a log. */
export const describeDatabase = (url = process.env.DATABASE_URL || '') =>
  url.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:***@');
