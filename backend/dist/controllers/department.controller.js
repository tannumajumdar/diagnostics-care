"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const department_model_1 = require("../models/department.model");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
const api_error_util_1 = require("../utils/api-error.util");
class DepartmentController {
    static getAll = async (req, res, next) => {
        try {
            const { search, status, page = 1, limit = 10 } = req.query;
            const filter = {};
            if (search) {
                filter.$or = [
                    { departmentName: { $regex: search, $options: 'i' } },
                    { departmentCode: { $regex: search, $options: 'i' } },
                ];
            }
            if (status)
                filter.status = status;
            const skip = (Number(page) - 1) * Number(limit);
            const [departments, total] = await Promise.all([
                department_model_1.Department.find(filter).sort({ departmentName: 1 }).skip(skip).limit(Number(limit)),
                department_model_1.Department.countDocuments(filter),
            ]);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Departments retrieved',
                data: departments,
                meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const dept = await department_model_1.Department.findById(id);
            if (!dept)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Department not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Department retrieved', data: dept });
        }
        catch (error) {
            next(error);
        }
    };
    static create = async (req, res, next) => {
        try {
            const dept = await department_model_1.Department.create(req.body);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.CREATED, message: 'Department created', data: dept });
        }
        catch (error) {
            next(error);
        }
    };
    static update = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const dept = await department_model_1.Department.findByIdAndUpdate(id, req.body, { new: true });
            if (!dept)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Department not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Department updated', data: dept });
        }
        catch (error) {
            next(error);
        }
    };
    static toggleStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const dept = await department_model_1.Department.findById(id);
            if (!dept)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Department not found');
            dept.status = dept.status === 'Active' ? 'Inactive' : 'Active';
            await dept.save();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Status updated', data: dept });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.DepartmentController = DepartmentController;
