"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleController = void 0;
const sample_service_1 = require("../services/sample.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class SampleController {
    static getAll = async (req, res, next) => {
        try {
            const result = await sample_service_1.SampleService.getAllSamples(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Samples retrieved',
                data: result.samples,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await sample_service_1.SampleService.getById(id);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample retrieved', data: result });
        }
        catch (error) {
            next(error);
        }
    };
    static getByBarcode = async (req, res, next) => {
        try {
            const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
            const result = await sample_service_1.SampleService.getByBarcode(barcode);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample barcode retrieved', data: result });
        }
        catch (error) {
            next(error);
        }
    };
    static getDashboardStats = async (_req, res, next) => {
        try {
            const stats = await sample_service_1.SampleService.getDashboardStats();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample dashboard stats', data: stats });
        }
        catch (error) {
            next(error);
        }
    };
    static updateStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUser = req.user;
            const result = await sample_service_1.SampleService.updateStatus(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample status updated', data: result });
        }
        catch (error) {
            next(error);
        }
    };
    static rejectSample = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUser = req.user;
            const result = await sample_service_1.SampleService.rejectSample(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample rejected', data: result });
        }
        catch (error) {
            next(error);
        }
    };
    static recollectSample = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUser = req.user;
            // currentUser was previously passed as the payload, so the audit entry
            // never recorded who ordered the repeat draw.
            const result = await sample_service_1.SampleService.recollectSample(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Repeat draw queued', data: result });
        }
        catch (error) {
            next(error);
        }
    };
    static getTimeline = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await sample_service_1.SampleService.getTimeline(id);
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Sample timeline retrieved', data: result });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.SampleController = SampleController;
