"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const invoice_model_1 = require("../models/invoice.model");
const payment_model_1 = require("../models/payment.model");
const patient_model_1 = require("../models/patient.model");
const sample_model_1 = require("../models/sample.model");
const result_model_1 = require("../models/result.model");
class ReportsService {
    static getDailyRevenueTrend = async () => {
        return invoice_model_1.Invoice.aggregate([
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
        return invoice_model_1.Invoice.aggregate([
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
        return patient_model_1.Patient.aggregate([
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
        return invoice_model_1.Invoice.aggregate([
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
        return invoice_model_1.Invoice.aggregate([
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
    static getDoctorWiseTests = async () => {
        return invoice_model_1.Invoice.aggregate([
            {
                $group: {
                    _id: '$referringDoctor',
                    invoiceCount: { $sum: 1 },
                    totalRevenue: { $sum: '$netAmount' },
                },
            },
            { $sort: { totalRevenue: -1 } },
        ]);
    };
    static getPaymentMethods = async () => {
        return payment_model_1.Payment.aggregate([
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
        const dueInvoices = await invoice_model_1.Invoice.find({ dueAmount: { $gt: 0 } }).populate('patient');
        const totalDue = dueInvoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
        return { totalDue, invoices: dueInvoices };
    };
    static getReportCompletionStats = async () => {
        return result_model_1.Result.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);
    };
    static getSampleRejections = async () => {
        return sample_model_1.Sample.aggregate([
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
        return invoice_model_1.Invoice.aggregate([
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
exports.ReportsService = ReportsService;
