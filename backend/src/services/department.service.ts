import { repo, regexAny, mongoSort } from '../db/repo';
import { AppError } from '../middleware/errorHandler';

export class DepartmentService {
  static getAll = async (params: { search?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = { AND: [] };
    if (params.search) {
      query.AND.push(await regexAny('department', ['departmentName', 'departmentCode'], params.search));
    }
    if (params.status) query.status = params.status;

    const [departments, total] = await Promise.all([
      repo.find('department', { where: query, orderBy: mongoSort('department', { departmentName: 1 }), skip, take: limit }),
      repo.count('department', query),
    ]);

    return {
      departments: departments.map((d: any) => ({
        id: d._id.toString(),
        departmentName: d.departmentName,
        departmentCode: d.departmentCode,
        description: d.description,
        status: d.status,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static create = async (data: any) => {
    const existing = await repo.findOne('department', { departmentCode: data.departmentCode.toUpperCase() });
    if (existing) throw new AppError('Department code already exists', 400);

    const dept = await repo.create('department', { ...data, departmentCode: data.departmentCode.toUpperCase() });
    return {
      id: dept._id.toString(),
      departmentName: dept.departmentName,
      departmentCode: dept.departmentCode,
      description: dept.description,
      status: dept.status,
    };
  };

  static update = async (id: string, data: any) => {
    const dept = await repo.updateById('department', id, data);
    if (!dept) throw new AppError('Department not found', 404);
    return {
      id: dept._id.toString(),
      departmentName: dept.departmentName,
      departmentCode: dept.departmentCode,
      description: dept.description,
      status: dept.status,
    };
  };
}
