import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';
import { Patient } from '../models/patient.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { Doctor } from '../models/doctor.model';
import mongoose from 'mongoose';

export class ReportsService {
  static getDailyRevenueTrend = async () => {
    return Invoice.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalInvoices: { $sum: 1 },
          grossSubtotal: { $sum: '$subtotal' },
          totalDiscount: { $sum: '$discountValue' },
          netAmount: { $sum: '$netAmount' },
          paidAmount: { $sum: '$paidAmount' },
          dueAmount: { $sum: '$dueAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  };

  static getDailyRevenue = ReportsService.getDailyRevenueTrend;

  static getMonthlyRevenue = async () => {
    return Invoice.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$netAmount' },
          collections: { $sum: '$paidAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  };

  static getMonthlyRevenueTrend = ReportsService.getMonthlyRevenue;

  static getPatientRegistrations = async () => {
    return Patient.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  };

  static getPatientRegistrationTrend = ReportsService.getPatientRegistrations;

  static getTestWiseRevenue = async () => {
    return Invoice.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.testName',
          totalCount: { $sum: 1 },
          totalRevenue: { $sum: '$items.netAmount' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);
  };

  static getDepartmentWiseTests = async () => {
    return Invoice.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.departmentName',
          testCount: { $sum: 1 },
          totalRevenue: { $sum: '$items.netAmount' },
        },
      },
      { $sort: { testCount: -1 } },
    ]);
  };

  /**
   * Grouped by the doctor's name, not by `referringDoctor`. That field is an
   * ObjectId, so the chart built on it was plotting raw 24-character ids along
   * its axis with one unnamed bucket for every walk-in. The typed name is on
   * every invoice whether or not the doctor is on the panel, which is what the
   * owner is reading this chart to find out.
   */
  static getDoctorWiseTests = async () => {
    return Invoice.aggregate([
      {
        $group: {
          _id: {
            $let: {
              vars: { name: { $trim: { input: { $ifNull: ['$referringDoctorName', ''] } } } },
              in: { $cond: [{ $eq: ['$$name', ''] }, 'Walk-in / Direct', '$$name'] },
            },
          },
          invoiceCount: { $sum: 1 },
          totalRevenue: { $sum: '$netAmount' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);
  };

  static getPaymentMethods = async () => {
    return Payment.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
  };

  static getPaymentMethodDistribution = ReportsService.getPaymentMethods;

  static getPendingDuePayments = async () => {
    const dueInvoices = await Invoice.find({ dueAmount: { $gt: 0 } }).populate('patient');
    const totalDue = dueInvoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
    return { totalDue, invoices: dueInvoices };
  };

  static getReportCompletionStats = async () => {
    return Result.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
  };

  static getSampleRejections = async () => {
    return Sample.aggregate([
      { $match: { status: 'Rejected' } },
      {
        $group: {
          _id: '$rejectionReason',
          count: { $sum: 1 },
        },
      },
    ]);
  };

  static getSampleRejectionAnalytics = ReportsService.getSampleRejections;

  static getCorporateRevenue = async () => {
    return Invoice.aggregate([
      { $match: { organization: { $ne: null } } },
      {
        $group: {
          _id: '$organization',
          revenue: { $sum: '$netAmount' },
          invoices: { $sum: 1 },
        },
      },
    ]);
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
    const match: any = { status: { $ne: 'Cancelled' } };

    if (from || to) {
      const range: any = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (!Number.isNaN(start.getTime())) range.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!Number.isNaN(end.getTime())) range.$lte = end;
      }
      if (Object.keys(range).length) match.createdAt = range;
    }

    if (doctor && mongoose.isValidObjectId(doctor)) {
      // The paneled doctor, and the same name typed in by hand at the counter.
      const panelDoctor = await Doctor.findById(doctor).select('doctorName').lean();
      const byName = panelDoctor?.doctorName
        ? [
            {
              referringDoctorName: {
                $regex: `^${panelDoctor.doctorName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: 'i',
              },
            },
          ]
        : [];
      match.$or = [{ referringDoctor: new mongoose.Types.ObjectId(doctor) }, ...byName];
    } else {
      // Only bills that name a referring doctor at all.
      match.$or = [
        { referringDoctor: { $ne: null } },
        { referringDoctorName: { $nin: [null, ''] } },
      ];
    }

    const invoices: any[] = await Invoice.find(match)
      .select('invoiceNumber uhid createdAt patient referringDoctor referringDoctorName items netAmount')
      .populate('patient', 'patientName uhid age gender mobile')
      .populate('referringDoctor', 'doctorName specialty')
      .sort({ createdAt: 1 })
      .lean();

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
