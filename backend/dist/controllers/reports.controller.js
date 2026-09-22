"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("../services/reports.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class ReportsController {
    static getDailyRevenue = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getDailyRevenueTrend();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Daily revenue trend', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getMonthlyRevenue = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getMonthlyRevenueTrend();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Monthly revenue trend', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getPatientRegistrations = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getPatientRegistrationTrend();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Patient registration trend', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getTestWiseRevenue = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getTestWiseRevenue();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Test-wise revenue & volume', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getDepartmentWiseTests = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getDepartmentWiseTests();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Department-wise test volume', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getDoctorWiseTests = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getDoctorWiseTests();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Doctor referral volume', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getPaymentMethods = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getPaymentMethodDistribution();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Payment method breakdown', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getPendingDuePayments = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getPendingDuePayments();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Pending due payments', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getReportCompletionStats = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getReportCompletionStats();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Report status stats', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getSampleRejectionAnalytics = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getSampleRejectionAnalytics();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample rejection reasons', data });
        }
        catch (error) {
            next(error);
        }
    };
    static getCorporateRevenue = async (_req, res, next) => {
        try {
            const data = await reports_service_1.ReportsService.getCorporateRevenue();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Corporate TPA revenue', data });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ReportsController = ReportsController;
