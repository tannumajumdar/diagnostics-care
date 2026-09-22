"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateHistoryService = void 0;
const rateHistory_model_1 = require("../models/rateHistory.model");
class RateHistoryService {
    static async getByTestId(testId) {
        return rateHistory_model_1.RateHistory.find({ testId }).sort({ createdAt: -1 });
    }
    static async getAll(limit = 50) {
        return rateHistory_model_1.RateHistory.find().sort({ createdAt: -1 }).limit(Number(limit));
    }
}
exports.RateHistoryService = RateHistoryService;
