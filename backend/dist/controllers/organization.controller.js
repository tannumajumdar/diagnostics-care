"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const organization_model_1 = require("../models/organization.model");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
const api_error_util_1 = require("../utils/api-error.util");
class OrganizationController {
    static getAll = async (req, res, next) => {
        try {
            const { search, status, page = 1, limit = 10 } = req.query;
            const filter = {};
            if (search) {
                filter.$or = [
                    { organizationName: { $regex: search, $options: 'i' } },
                    { contactPerson: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } },
                ];
            }
            if (status)
                filter.status = status;
            const skip = (Number(page) - 1) * Number(limit);
            const [organizations, total] = await Promise.all([
                organization_model_1.Organization.find(filter).sort({ organizationName: 1 }).skip(skip).limit(Number(limit)),
                organization_model_1.Organization.countDocuments(filter),
            ]);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Organizations retrieved',
                data: organizations,
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
            const org = await organization_model_1.Organization.findById(id);
            if (!org)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Organization not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Organization retrieved', data: org });
        }
        catch (error) {
            next(error);
        }
    };
    static create = async (req, res, next) => {
        try {
            const org = await organization_model_1.Organization.create(req.body);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.CREATED, message: 'Organization created', data: org });
        }
        catch (error) {
            next(error);
        }
    };
    static update = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const org = await organization_model_1.Organization.findByIdAndUpdate(id, req.body, { new: true });
            if (!org)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Organization not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Organization updated', data: org });
        }
        catch (error) {
            next(error);
        }
    };
    static toggleStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const org = await organization_model_1.Organization.findById(id);
            if (!org)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Organization not found');
            org.status = org.status === 'Active' ? 'Inactive' : 'Active';
            await org.save();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Status updated', data: org });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.OrganizationController = OrganizationController;
