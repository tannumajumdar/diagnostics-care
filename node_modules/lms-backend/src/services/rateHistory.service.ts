import { RateHistory } from '../models/rateHistory.model';

export class RateHistoryService {
  static async getByTestId(testId: string) {
    return RateHistory.find({ testId }).sort({ createdAt: -1 });
  }

  static async getAll(limit = 50) {
    return RateHistory.find().sort({ createdAt: -1 }).limit(Number(limit));
  }
}

