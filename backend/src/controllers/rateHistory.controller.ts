import { Request, Response, NextFunction } from 'express';
import { RateHistory } from '../models/rateHistory.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';

export class RateHistoryController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testId, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (testId) filter.test = testId;

      const skip = (Number(page) - 1) * Number(limit);
      const [history, total] = await Promise.all([
        RateHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        RateHistory.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Rate history retrieved',
        data: history,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getByTestId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const testId = Array.isArray(req.params.testId) ? req.params.testId[0] : req.params.testId;
      const history = await RateHistory.find({ test: testId }).sort({ createdAt: -1 });
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test rate history retrieved', data: history });
    } catch (error) {
      next(error);
    }
  };
}

