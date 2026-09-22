import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';
import { Patient } from '../models/patient.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';

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
}
