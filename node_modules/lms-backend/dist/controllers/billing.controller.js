"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const billing_service_1 = require("../services/billing.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class BillingController {
    static createInvoice = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await billing_service_1.BillingService.createInvoice(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: `Invoice ${result.invoice.invoiceNumber} created successfully`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static createVisit = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await billing_service_1.BillingService.createVisit(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: `Visit registered - invoice ${result.invoice.invoiceNumber}, ${result.samples.length} sample(s) queued`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const result = await billing_service_1.BillingService.getAllInvoices(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Invoices retrieved successfully',
                data: result.invoices,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await billing_service_1.BillingService.getInvoiceById(id);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Invoice details retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getByBarcode = async (req, res, next) => {
        try {
            const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
            const result = await billing_service_1.BillingService.getByBarcode(barcode);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Invoice retrieved by barcode',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static addPayment = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUser = req.user;
            const result = await billing_service_1.BillingService.addPayment(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `Payment receipt ${result.paymentRecord.receiptNumber} generated successfully`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.BillingController = BillingController;
