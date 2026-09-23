"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsController = void 0;
const accounts_service_1 = require("../services/accounts.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class AccountsController {
    static getDailyCollections = async (req, res, next) => {
        try {
            const date = req.query.date;
            const result = await accounts_service_1.AccountsService.getDailyCollections(date);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Daily collections retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getCollectionTrend = async (req, res, next) => {
        try {
            const { from, to, days } = req.query;
            const result = await accounts_service_1.AccountsService.getCollectionTrend({ from, to, days });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Collections by day retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getOverallCollections = async (_req, res, next) => {
        try {
            const result = await accounts_service_1.AccountsService.getOverallCollections();
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Overall collections retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static createRefund = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await accounts_service_1.AccountsService.createRefund(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: 'Refund issued successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAllRefunds = async (req, res, next) => {
        try {
            const result = await accounts_service_1.AccountsService.getAllRefunds(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Refunds retrieved',
                data: result.refunds,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static createPayout = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await accounts_service_1.AccountsService.createPayout(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: result.status === 'Pending'
                    ? `Payout of Rs.${result.amount} to ${result.payeeName} recorded and sent for Admin approval`
                    : `Payout of Rs.${result.amount} to ${result.payeeName} recorded`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAllPayouts = async (req, res, next) => {
        try {
            const result = await accounts_service_1.AccountsService.getAllPayouts(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Payouts retrieved',
                data: result.payouts,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getPayoutSummary = async (req, res, next) => {
        try {
            const result = await accounts_service_1.AccountsService.getPayoutSummary({
                from: req.query.from,
                to: req.query.to,
            });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Payout report generated',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static updatePayoutStatus = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await accounts_service_1.AccountsService.updatePayoutStatus(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `Payout marked ${result.status}`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static deletePayout = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await accounts_service_1.AccountsService.deletePayout(id, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `Payout ${result.expenseId} deleted`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getDoctorCommissionReport = async (_req, res, next) => {
        try {
            const result = await accounts_service_1.AccountsService.getDoctorCommissionReport();
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Doctor commission report generated',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getLedger = async (req, res, next) => {
        try {
            const { patientId, search, from, to, paymentMethod, flowType, payeeType, page, limit } = req.query;
            const result = await accounts_service_1.AccountsService.getLedger({
                patientId,
                search,
                from,
                to,
                paymentMethod,
                flowType: flowType,
                payeeType,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
            });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Payment ledger retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.AccountsController = AccountsController;
