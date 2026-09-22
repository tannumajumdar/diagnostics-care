"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
const department_model_1 = require("../models/department.model");
const errorHandler_1 = require("../middleware/errorHandler");
class DepartmentService {
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (params.search) {
            query.$or = [
                { departmentName: { $regex: params.search, $options: 'i' } },
                { departmentCode: { $regex: params.search, $options: 'i' } },
            ];
        }
        if (params.status)
            query.status = params.status;
        const [departments, total] = await Promise.all([
            department_model_1.Department.find(query).sort({ departmentName: 1 }).skip(skip).limit(limit),
            department_model_1.Department.countDocuments(query),
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
    static create = async (data) => {
        const existing = await department_model_1.Department.findOne({ departmentCode: data.departmentCode.toUpperCase() });
        if (existing)
            throw new errorHandler_1.AppError('Department code already exists', 400);
        const dept = await department_model_1.Department.create({ ...data, departmentCode: data.departmentCode.toUpperCase() });
        return {
            id: dept._id.toString(),
            departmentName: dept.departmentName,
            departmentCode: dept.departmentCode,
            description: dept.description,
            status: dept.status,
        };
    };
    static update = async (id, data) => {
        const dept = await department_model_1.Department.findByIdAndUpdate(id, data, { new: true });
        if (!dept)
            throw new errorHandler_1.AppError('Department not found', 404);
        return {
            id: dept._id.toString(),
            departmentName: dept.departmentName,
            departmentCode: dept.departmentCode,
            description: dept.description,
            status: dept.status,
        };
    };
}
exports.DepartmentService = DepartmentService;
