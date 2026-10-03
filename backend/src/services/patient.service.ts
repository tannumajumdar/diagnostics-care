import { repo, regexAny, mongoSort } from '../db/repo';
import { getNextSequenceValue } from '../db/counters';
import { AppError } from '../middleware/errorHandler';

export class PatientService {
  static getAll = async (params: { search?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = { AND: [] };
    if (params.search) query.AND.push(await regexAny('patient', ['patientName', 'uhid', 'mobile'], params.search));
    if (params.status) query.status = params.status;

    const [patients, total] = await Promise.all([
      repo.find('patient', { where: query, orderBy: mongoSort('patient', { createdAt: -1 }), skip, take: limit }),
      repo.count('patient', query),
    ]);

    return {
      patients: patients.map((p: any) => ({
        id: p._id.toString(),
        uhid: p.uhid,
        patientName: p.patientName,
        gender: p.gender,
        age: p.age,
        mobile: p.mobile,
        status: p.status,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static create = async (data: any) => {
    const nextSeq = await getNextSequenceValue('uhid');
    const uhid = `UHID-${new Date().getFullYear()}-${nextSeq.toString().padStart(6, '0')}`;

    const patient = await repo.create('patient', { ...data, uhid });
    return {
      id: patient._id.toString(),
      uhid: patient.uhid,
      patientName: patient.patientName,
      gender: patient.gender,
      age: patient.age,
      mobile: patient.mobile,
      status: patient.status,
    };
  };
}

