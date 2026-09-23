"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundPolicyController = void 0;
const refundPolicy_service_1 = require("../services/refundPolicy.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class RefundPolicyController {
    static getPolicy = async (_req, res, next) => {
        try {
            const data = await refundPolicy_service_1.RefundPolicyService.getPolicyForScreen();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Refund policy retrieved', data });
        }
        catch (error) {
            next(error);
        }
    };
    static updatePolicy = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const data = await refundPolicy_service_1.RefundPolicyService.updatePolicy(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Refund policy saved', data });
        }
        catch (error) {
            next(error);
        }
    };
    /** What each line on a bill is worth back today. Reads nothing into the books. */
    static getQuote = async (req, res, next) => {
        try {
            const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
            const data = await refundPolicy_service_1.RefundPolicyService.quoteForInvoice(invoiceId);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Cancellation quote retrieved', data });
        }
        catch (error) {
            next(error);
        }
    };
    static cancelTests = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const data = await refundPolicy_service_1.RefundPolicyService.cancelTestsAndRefund(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: data.cashRefund > 0 ? 'Tests cancelled and refund issued' : 'Tests cancelled and the bill adjusted',
                data,
            });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.RefundPolicyController = RefundPolicyController;
