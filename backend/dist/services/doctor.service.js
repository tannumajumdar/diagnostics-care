"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorService = void 0;
const doctor_model_1 = require("../models/doctor.model");
class DoctorService {
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (params.search) {
            query.$or = [
                { doctorName: { $regex: params.search, $options: 'i' } },
                { mobile: { $regex: params.search, $options: 'i' } },
            ];
        }
        if (params.department)
            query.department = params.department;
        if (params.status)
            query.status = params.status;
        const [doctors, total] = await Promise.all([
            doctor_model_1.Doctor.find(query).populate('department').sort({ doctorName: 1 }).skip(skip).limit(limit),
            doctor_model_1.Doctor.countDocuments(query),
        ]);
        return {
            doctors: doctors.map((d) => ({
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
    static create = async (data) => {
        const doctor = await doctor_model_1.Doctor.create(data);
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
exports.DoctorService = DoctorService;
