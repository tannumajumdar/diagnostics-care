import { Department } from '../models/department.model';
import { AppError } from '../middleware/errorHandler';

export class DepartmentService {
  static getAll = async (params: { search?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (params.search) {
      query.$or = [
        { departmentName: { $regex: params.search, $options: 'i' } },
        { departmentCode: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.status) query.status = params.status;

    const [departments, total] = await Promise.all([
      Department.find(query).sort({ departmentName: 1 }).skip(skip).limit(limit),
      Department.countDocuments(query),
    ]);

    return {
      departments: departments.map((d) => ({
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
    const existing = await Department.findOne({ departmentCode: data.departmentCode.toUpperCase() });
    if (existing) throw new AppError('Department code already exists', 400);

    const dept = await Department.create({ ...data, departmentCode: data.departmentCode.toUpperCase() });
    return {
      id: dept._id.toString(),
      departmentName: dept.departmentName,
      departmentCode: dept.departmentCode,
      description: dept.description,
      status: dept.status,
    };
  };

  static update = async (id: string, data: any) => {
    const dept = await Department.findByIdAndUpdate(id, data, { new: true });
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

