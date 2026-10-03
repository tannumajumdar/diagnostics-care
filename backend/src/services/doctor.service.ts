import { repo, regexAny, mongoSort, refFilter } from '../db/repo';
import { AppError } from '../middleware/errorHandler';

export class DoctorService {
  static getAll = async (params: { search?: string; department?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = { AND: [] };
    if (params.search) query.AND.push(await regexAny('doctor', ['doctorName', 'mobile'], params.search));
    if (params.department) query.departmentId = refFilter(params.department, 'department');
    if (params.status) query.status = params.status;

    const [doctors, total] = await Promise.all([
      repo.find('doctor', {
        where: query,
        include: { department: true },
        orderBy: mongoSort('doctor', { doctorName: 1 }),
        skip,
        take: limit,
      }),
      repo.count('doctor', query),
    ]);

    return {
      doctors: doctors.map((d: any) => ({
        id: d._id.toString(),
        doctorName: d.doctorName,
        department: d.department ? { id: d.department._id.toString(), departmentName: d.department.departmentName } : null,
        degree: d.degree,
        specialty: d.specialty,
        mobile: d.mobile,
        email: d.email,
        hospital: d.hospital,
        paymentTerm: d.paymentTerm,
        discountType: d.discountType,
        discountPercentage: d.discountPercentage,
        commission: d.commission,
        status: d.status,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static create = async (data: any) => {
    const doctor = await repo.create('doctor', data);
    return {
      id: doctor._id.toString(),
      doctorName: doctor.doctorName,
      department: doctor.department?.toString(),
      mobile: doctor.mobile,
      hospital: doctor.hospital,
      status: doctor.status,
    };
  };
}

