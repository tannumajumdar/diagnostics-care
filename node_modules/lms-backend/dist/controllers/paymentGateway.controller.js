"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayController = void 0;
const paymentGateway_service_1 = require("../services/paymentGateway.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class PaymentGatewayController {
    static initiate = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const data = await paymentGateway_service_1.PaymentGatewayService.initiate(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: data.method === 'UPI'
                    ? 'UPI collection request raised'
                    : 'Amount sent to the card terminal',
                data,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getStatus = async (req, res, next) => {
        try {
            const data = await paymentGateway_service_1.PaymentGatewayService.getStatus(String(req.params.txnId));
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Payment attempt status', data });
        }
        catch (error) {
            next(error);
        }
    };
    /** The simulator's endpoint - see the note on the route. */
    static simulate = async (req, res, next) => {
        try {
            const { token, outcome, reason, cardLast4, cardNetwork, vpa } = req.body;
            const data = await paymentGateway_service_1.PaymentGatewayService.simulate(String(req.params.txnId), token, outcome, {
                reason,
                cardLast4,
                cardNetwork,
                vpa,
            });
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Payer responded', data });
        }
        catch (error) {
            next(error);
        }
    };
    static cancel = async (req, res, next) => {
        try {
            const data = await paymentGateway_service_1.PaymentGatewayService.cancel(String(req.params.txnId));
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Payment attempt cancelled', data });
        }
        catch (error) {
            next(error);
        }
    };
    static listForInvoice = async (req, res, next) => {
        try {
            const data = await paymentGateway_service_1.PaymentGatewayService.listForInvoice(String(req.params.invoiceId));
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Payment attempts retrieved', data });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.PaymentGatewayController = PaymentGatewayController;
