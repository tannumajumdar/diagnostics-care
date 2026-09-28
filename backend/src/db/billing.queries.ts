/**
 * The two billing directory reads that were Mongo aggregations, in SQL.
 *
 * Both keep the shape of the pipeline they replace step for step - which
 * bills are in view, which of their lines, what each line's sample and report
 * look like - so the rows, totals and day counts come out the same.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { SAMPLE_STATUS } from '../constants/workflow';

/**
 * A Date for comparing against a column. Prisma stores DateTime as a UTC
 * `timestamp` but binds a raw-query Date as `timestamptz`, and Postgres
 * reconciles the two through the session time zone - which is the server's,
 * not UTC. Converting the parameter to a UTC timestamp first keeps the
 * comparison exact whatever the database's time zone is.
 */
export const utc = (date: Date) => Prisma.sql`(${date}::timestamptz AT TIME ZONE 'UTC')`;

/*
 * Numbers: columns are numeric and come back from a raw query as Decimals, so
 * rows are passed through fromDecimal by the caller. A total is summed in
 * numeric - exact - and cast to float8 once at the end (numeric -> float8 is
 * exact; float8 -> numeric is not, it keeps 15 digits).
 */

/** Text for a LIKE pattern, its own % and _ taken literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** `{ $regex: <escaped text>, $options: 'i' }`: a case-insensitive "contains". */
export const containsSql = (column: Prisma.Sql, text: string) =>
  Prisma.sql`${column} ILIKE '%' || ${escapeLike(text)} || '%'`;

/**
 * Bills paid by one method: a split bill under every method in its breakdown,
 * an older bill with no breakdown under its filed method once money came in,
 * and Credit as the bill left to be collected later. As a Prisma `where`.
 */
export function paymentMethodWhere(method: string): any {
  if (method === 'Credit') return { OR: [{ paymentMethod: 'Credit' }, { paymentStatus: 'Credit' }] };
  return {
    OR: [
      { paymentBreakdown: { some: { method } } },
      { paymentBreakdown: { none: {} }, paymentMethod: method, paidAmount: { gt: 0 } },
    ],
  };
}

/** The same rule as a SQL condition on an invoice aliased `b`. */
export function paymentMethodSql(method: string): Prisma.Sql {
  if (method === 'Credit') return Prisma.sql`(b."paymentMethod" = 'Credit' OR b."paymentStatus" = 'Credit')`;
  return Prisma.sql`(
    EXISTS (SELECT 1 FROM "InvoicePaymentSplit" ps WHERE ps."invoiceId" = b.id AND ps.method = ${method})
    OR (NOT EXISTS (SELECT 1 FROM "InvoicePaymentSplit" ps WHERE ps."invoiceId" = b.id)
        AND b."paymentMethod" = ${method} AND b."paidAmount" > 0)
  )`;
}

export interface BookedTestsFilter {
  bill: Prisma.Sql[];
  line: Prisma.Sql[];
  status: Prisma.Sql[];
  /** Day counts leave cancelled lines out unless cancellations are the question. */
  dayCountsSkipCancelled: boolean;
  skip: number;
  take: number;
  withDayCounts: boolean;
  timeZone: string;
}

const and = (parts: Prisma.Sql[]) => (parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`);

/**
 * Every test on every bill in view, one row per line, with where its sample
 * has got to and - once the whole visit is released - the report to print.
 */
export async function bookedTests(f: BookedTestsFilter) {
  // One row per bill line that passes the filters, carrying its sample: the
  // first sample drawn for that test on that bill, as the $lookup's $limit: 1
  // took it.
  const lines = Prisma.sql`
    SELECT
      b.id AS "invoiceId", b."insertOrder" AS "billOrder", b."createdAt", b."invoiceNumber", b."enquiryNo",
      b.barcode, b.uhid, b."paymentStatus", b."dueAmount", b."patientId", b."referringDoctorId",
      b."referringDoctorName", b."organizationId",
      it.position AS "itemIndex", it."testName", it."testCode", it."departmentName", it."packageName",
      it."processingMode", it.rate, it."netAmount", it.cancelled, it."cancelledAt", it."cancellationReason",
      it."refundedAmount",
      s.id AS "sampleKey", s."sampleId", s.status AS "sampleStatus"
    FROM "Invoice" b
    JOIN "InvoiceItem" it ON it."invoiceId" = b.id
    LEFT JOIN LATERAL (
      SELECT id, "sampleId", status FROM "Sample"
      WHERE "invoiceId" = b.id AND "testId" = it."testId"
      ORDER BY "insertOrder" LIMIT 1
    ) s ON TRUE
    WHERE ${and(f.bill)} AND ${and(f.line)} AND ${and(f.status)}`;

  const rows = await prisma.$queryRaw<any[]>`
    WITH lines AS (${lines}),
    page AS (
      SELECT * FROM lines
      ORDER BY "createdAt" DESC, "itemIndex" ASC, "billOrder" ASC
      OFFSET ${f.skip} LIMIT ${f.take}
    )
    SELECT
      page.*,
      p.id AS "patientKey", p."patientName", p.uhid AS "patientUhid", p.mobile AS "patientMobile",
      d."doctorName" AS "panelDoctorName",
      o."organizationName",
      r.id AS "resultKey", r.status AS "resultStatus",
      EXISTS (
        SELECT 1 FROM "Sample" vs
        WHERE vs."invoiceId" = page."invoiceId" AND vs.status <> ${SAMPLE_STATUS.CANCELLED}
          AND NOT (
            vs.status = ${SAMPLE_STATUS.COMPLETED}
            AND EXISTS (SELECT 1 FROM "Result" vr WHERE vr."sampleId" = vs.id AND vr.status IN ('Approved', 'Final'))
          )
      ) AS unreleased
    FROM page
    LEFT JOIN "Patient" p ON p.id = page."patientId"
    LEFT JOIN "Doctor" d ON d.id = page."referringDoctorId"
    LEFT JOIN "Organization" o ON o.id = page."organizationId"
    LEFT JOIN LATERAL (
      SELECT id, status FROM "Result" WHERE "sampleId" = page."sampleKey" ORDER BY "insertOrder" LIMIT 1
    ) r ON TRUE
    ORDER BY page."createdAt" DESC, page."itemIndex" ASC, page."billOrder" ASC`;

  const [totals] = await prisma.$queryRaw<any[]>`
    WITH lines AS (${lines})
    SELECT
      COUNT(*)::int AS tests,
      SUM(CASE WHEN cancelled THEN 0 ELSE "netAmount" END)::float8 AS billed,
      SUM(CASE WHEN cancelled THEN 1 ELSE 0 END)::int AS cancelled,
      SUM("refundedAmount")::float8 AS refunded
    FROM lines`;

  let dayCounts: any[] | undefined;
  if (f.withDayCounts) {
    const skipCancelled = f.dayCountsSkipCancelled ? Prisma.sql`WHERE NOT cancelled` : Prisma.empty;
    dayCounts = await prisma.$queryRaw<any[]>`
      WITH lines AS (${lines})
      SELECT
        to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${f.timeZone}, 'YYYY-MM-DD') AS day,
        "testName",
        (array_agg("testCode" ORDER BY "createdAt" DESC, "itemIndex" ASC, "billOrder" ASC))[1] AS "testCode",
        (array_agg("departmentName" ORDER BY "createdAt" DESC, "itemIndex" ASC, "billOrder" ASC))[1] AS "departmentName",
        COUNT(*)::int AS count
      FROM lines ${skipCancelled}
      GROUP BY 1, 2
      ORDER BY day DESC, count DESC, "testName" ASC`;
  }

  return { rows, totals, dayCounts };
}
