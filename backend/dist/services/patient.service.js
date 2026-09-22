"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientService = void 0;
const patient_model_1 = require("../models/patient.model");
const counter_model_1 = require("../models/counter.model");
class PatientService {
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (params.search) {
            query.$or = [
                { patientName: { $regex: params.search, $options: 'i' } },
                { uhid: { $regex: params.search, $options: 'i' } },
                { mobile: { $regex: params.search, $options: 'i' } },
            ];
        }
        if (params.status)
            query.status = params.status;
        const [patients, total] = await Promise.all([
            patient_model_1.Patient.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            patient_model_1.Patient.countDocuments(query),
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
    static create = async (data) => {
        const nextSeq = await (0, counter_model_1.getNextSequenceValue)('uhid');
        const uhid = `UHID-${new Date().getFullYear()}-${nextSeq.toString().padStart(6, '0')}`;
        const patient = await patient_model_1.Patient.create({ ...data, uhid });
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
exports.PatientService = PatientService;
