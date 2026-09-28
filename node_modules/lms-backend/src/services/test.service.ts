import { repo, mongoSort, refFilter } from '../db/repo';
import { AppError } from '../middleware/errorHandler';
import { testSearchWhere } from '../utils/search.util';

export class TestService {
  static getAll = async (params: { search?: string; department?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = { AND: [] };
    // Name, code, the parameters inside the test, and the initials of the
    // words - the desk types APTT and Hb, not the full name off the menu.
    if (params.search) {
      const where = await testSearchWhere(params.search);
      if (where) query.AND.push(where);
    }
    if (params.department) query.departmentId = refFilter(params.department, 'department');
    if (params.status) query.status = params.status;

    const [tests, total] = await Promise.all([
      repo.find('labTest', {
        where: query,
        include: { department: true },
        orderBy: mongoSort('labTest', { testName: 1 }),
        skip,
        take: limit,
      }),
      repo.count('labTest', query),
    ]);

    return {
      tests: tests.map((t: any) => ({
        id: t._id.toString(),
        testName: t.testName,
        testCode: t.testCode,
        department: t.department ? { id: t.department._id.toString(), departmentName: t.department.departmentName } : null,
        sampleType: t.sampleType,
        sampleContainer: t.sampleContainer,
        rate: t.rate,
        patientRate: t.patientRate,
        corporateRate: t.corporateRate,
        doctorRate: t.doctorRate,
        emergencyRate: t.emergencyRate,
        referralRate: t.referralRate,
        processingMode: t.processingMode,
        outsourceLab: t.outsourceLab,
        outsourceCost: t.outsourceCost,
        discountAllowed: t.discountAllowed,
        fastingRequired: t.fastingRequired,
        turnaroundTime: t.turnaroundTime,
        status: t.status,
        parameters: t.parameters,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static create = async (data: any) => {
    const test = await repo.create('labTest', data);
    return {
      id: test._id.toString(),
      testName: test.testName,
      testCode: test.testCode,
      rate: test.rate,
      sampleContainer: test.sampleContainer,
      status: test.status,
    };
  };
}

