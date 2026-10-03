import { prisma } from '../db/prisma';
import { repo, mongoSort } from '../db/repo';
import { isObjectId } from '../db/ids';

/**
 * The owner's charts. Each was a Mongo aggregation grouping on a day, a month,
 * a test or a doctor; the SQL below groups the same way. Days and months are
 * UTC days, as `$dateToString` without a timezone cut them.
 */
export class ReportsService {
  static getDailyRevenueTrend = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT
        to_char("createdAt", 'YYYY-MM-DD') AS "_id",
        COUNT(*)::int AS "totalInvoices",
        SUM(subtotal)::float8 AS "grossSubtotal",
        SUM("discountValue")::float8 AS "totalDiscount",
        SUM("netAmount")::float8 AS "netAmount",
        SUM("paidAmount")::float8 AS "paidAmount",
        SUM("dueAmount")::float8 AS "dueAmount"
      FROM "Invoice"
      GROUP BY 1
      ORDER BY 1`;
  };

  static getDailyRevenue = ReportsService.getDailyRevenueTrend;

  static getMonthlyRevenue = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT to_char("createdAt", 'YYYY-MM') AS "_id", SUM("netAmount")::float8 AS revenue, SUM("paidAmount")::float8 AS collections
      FROM "Invoice"
      GROUP BY 1
      ORDER BY 1`;
  };

  static getMonthlyRevenueTrend = ReportsService.getMonthlyRevenue;

  static getPatientRegistrations = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS "_id", COUNT(*)::int AS count
      FROM "Patient"
      GROUP BY 1
      ORDER BY 1`;
  };

  static getPatientRegistrationTrend = ReportsService.getPatientRegistrations;

  static getTestWiseRevenue = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT "testName" AS "_id", COUNT(*)::int AS "totalCount", SUM("netAmount")::float8 AS "totalRevenue"
      FROM "InvoiceItem"
      GROUP BY 1
      ORDER BY "totalRevenue" DESC, 1`;
  };

  static getDepartmentWiseTests = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT "departmentName" AS "_id", COUNT(*)::int AS "testCount", SUM("netAmount")::float8 AS "totalRevenue"
      FROM "InvoiceItem"
      GROUP BY 1
      ORDER BY "testCount" DESC, 1`;
  };

  /**
   * Grouped by the doctor's name, not by `referringDoctor`. That field is an
   * id, so the chart built on it was plotting raw 24-character ids along its
   * axis with one unnamed bucket for every walk-in. The typed name is on every
   * invoice whether or not the doctor is on the panel, which is what the owner
   * is reading this chart to find out.
   */
  static getDoctorWiseTests = async () => {
    // `$trim` took whitespace off both ends; btrim with no characters takes spaces only.
    return prisma.$queryRaw<any[]>`
      SELECT
        CASE WHEN btrim("referringDoctorName", E' \\t\\n\\r\\f\\v') = '' THEN 'Walk-in / Direct'
             ELSE btrim("referringDoctorName", E' \\t\\n\\r\\f\\v') END AS "_id",
        COUNT(*)::int AS "invoiceCount",
        SUM("netAmount")::float8 AS "totalRevenue"
      FROM "Invoice"
      GROUP BY 1
      ORDER BY "totalRevenue" DESC, 1`;
  };

  static getPaymentMethods = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT "paymentMethod" AS "_id", SUM(amount)::float8 AS "totalAmount", COUNT(*)::int AS count
      FROM "Payment"
      GROUP BY 1`;
  };

  static getPaymentMethodDistribution = ReportsService.getPaymentMethods;

  static getPendingDuePayments = async () => {
    const dueInvoices = await repo.find('invoice', { where: { dueAmount: { gt: 0 } }, include: { patient: true } });
    const totalDue = dueInvoices.reduce((sum: number, inv: any) => sum + inv.dueAmount, 0);
    return { totalDue, invoices: dueInvoices };
  };

  static getReportCompletionStats = async () => {
    return prisma.$queryRaw<any[]>`SELECT status AS "_id", COUNT(*)::int AS count FROM "Result" GROUP BY 1`;
  };

  static getSampleRejections = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT "rejectionReason" AS "_id", COUNT(*)::int AS count
      FROM "Sample"
      WHERE status = 'Rejected'
      GROUP BY 1`;
  };

  static getSampleRejectionAnalytics = ReportsService.getSampleRejections;

  static getCorporateRevenue = async () => {
    return prisma.$queryRaw<any[]>`
      SELECT "organizationId" AS "_id", SUM("netAmount")::float8 AS revenue, COUNT(*)::int AS invoices
      FROM "Invoice"
      WHERE "organizationId" IS NOT NULL
      GROUP BY 1`;
  };

  /**
   * Every bill a doctor referred, visit by visit: the day, the patient, the
   * tests that were run and what the doctor's referral charges on it come to.
   *
   * The charge is the doctor's-copy arrangement, line by line: the doctor's
   * patient is billed the test's referral rate, the centre keeps its own rate,
   * and the difference is the doctor's. Both rates are the ones frozen on the
   * bill, so an old month reads at the rates agreed on the day. A test the
   * patient cancelled earns nothing.
   */
  static getDoctorReferralReport = async (query: { from?: string; to?: string; doctor?: string }) => {
    const { from, to, doctor } = query;
    // A bill has no status of its own; the old `status: { $ne: 'Cancelled' }`
    // matched every bill, so there is nothing to filter on here.
    const match: any = { AND: [] };

    if (from || to) {
      const range: any = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (!Number.isNaN(start.getTime())) range.gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!Number.isNaN(end.getTime())) range.lte = end;
      }
      if (Object.keys(range).length) match.createdAt = range;
    }

    if (doctor && isObjectId(doctor)) {
      const key = doctor.toLowerCase();
      // The paneled doctor, and the same name typed in by hand at the counter.
      const panelDoctor = await prisma.doctor.findUnique({ where: { id: key }, select: { doctorName: true } });
      const byName = panelDoctor?.doctorName
        ? [{ referringDoctorName: { equals: panelDoctor.doctorName.trim(), mode: 'insensitive' as const } }]
        : [];
      match.AND.push({ OR: [{ referringDoctorId: key }, ...byName] });
    } else {
      // Only bills that name a referring doctor at all.
      match.AND.push({ OR: [{ referringDoctorId: { not: null } }, { referringDoctorName: { not: '' } }] });
    }

    const invoices: any[] = await repo.find('invoice', {
      where: match,
      include: {
        patient: { select: { id: true, patientName: true, uhid: true, age: true, dateOfBirth: true, gender: true, mobile: true } },
        referringDoctor: { select: { id: true, doctorName: true, specialty: true } },
      },
      orderBy: mongoSort('invoice', { createdAt: 1 }),
    });

    return invoices
      .map((inv) => {
        const panel = inv.referringDoctor && typeof inv.referringDoctor === 'object' ? inv.referringDoctor : null;
        const tests = (inv.items || [])
          .filter((item: any) => !item.cancelled)
          .map((item: any) => {
            const rate = Number(item.rate) || 0;
            // Unset on a line means the doctor's copy printed the centre's own rate.
            const referralRate = Number(item.referralRate) || rate;
            return {
              testName: item.testName,
              testCode: item.testCode,
              rate,
              referralRate,
              charges: Math.max(0, referralRate - rate),
            };
          });
        const sum = (key: 'rate' | 'referralRate' | 'charges') =>
          tests.reduce((total: number, t: any) => total + t[key], 0);
        return {
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          billedAt: inv.createdAt,
          uhid: inv.uhid,
          patient: inv.patient
            ? {
                patientName: inv.patient.patientName,
                age: inv.patient.age,
                gender: inv.patient.gender,
                mobile: inv.patient.mobile,
              }
            : null,
          doctorId: panel?._id || null,
          // The panel's name wins over whatever was typed at the counter.
          doctorName: panel?.doctorName || inv.referringDoctorName || 'Unknown',
          onPanel: !!panel,
          tests,
          rate: sum('rate'),
          referralRate: sum('referralRate'),
          charges: sum('charges'),
        };
      })
      .filter((row) => row.tests.length > 0);
  };
}
