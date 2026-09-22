"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateHistoryController = void 0;
const rateHistory_model_1 = require("../models/rateHistory.model");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class RateHistoryController {
    static getAll = async (req, res, next) => {
        try {
            const { testId, page = 1, limit = 10 } = req.query;
            const filter = {};
            if (testId)
                filter.test = testId;
            const skip = (Number(page) - 1) * Number(limit);
            const [history, total] = await Promise.all([
                rateHistory_model_1.RateHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
                rateHistory_model_1.RateHistory.countDocuments(filter),
            ]);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Rate history retrieved',
                data: history,
                meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getByTestId = async (req, res, next) => {
        try {
            const testId = Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId;
            const history = await rateHistory_model_1.RateHistory.find({ test: testId }).sort({ createdAt: -1 });
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Test rate history retrieved', data: history });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.RateHistoryController = RateHistoryController;
