import { repo, mongoSort, refFilter } from '../db/repo';

/**
 * Not wired to any route. The Mongoose version filtered on a `testId` path the
 * schema does not have; this reads the test's own trail, which is what the
 * name promises.
 */
export class RateHistoryService {
  static async getByTestId(testId: string) {
    return repo.find('rateHistory', {
      where: { testId: refFilter(testId, 'test') },
      orderBy: mongoSort('rateHistory', { createdAt: -1 }),
    });
  }

  static async getAll(limit = 50) {
    return repo.find('rateHistory', { orderBy: mongoSort('rateHistory', { createdAt: -1 }), take: Number(limit) });
  }
}
