import { Patient } from '../models/patient.model';
import { getNextSequenceValue } from '../models/counter.model';
import { AppError } from '../middleware/errorHandler';

export class PatientService {
  static getAll = async (params: { search?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (params.search) {
      query.$or = [
        { patientName: { $regex: params.search, $options: 'i' } },
        { uhid: { $regex: params.search, $options: 'i' } },
        { mobile: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.status) query.status = params.status;

    const [patients, total] = await Promise.all([
      Patient.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Patient.countDocuments(query),
    ]);

    return {
      patients: patients.map((p) => ({
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

    const patient = await Patient.create({ ...data, uhid });
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

