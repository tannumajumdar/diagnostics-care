"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultController = void 0;
const result_service_1 = require("../services/result.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class ResultController {
    static saveDraft = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await result_service_1.ResultService.saveDraft(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Result draft saved successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static submitResult = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const result = await result_service_1.ResultService.submitResult(req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Result submitted for Pathologist verification',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getPendingVerification = async (req, res, next) => {
        try {
            const result = await result_service_1.ResultService.getPendingVerification(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Pending verification queue retrieved',
                data: result.results,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const result = await result_service_1.ResultService.getAllResults(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Results retrieved successfully',
                data: result.results,
                meta: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getBySampleId = async (req, res, next) => {
        try {
            const sampleId = Array.isArray(req.params.sampleId) ? req.params.sampleId[0] : req.params.sampleId;
            const result = await result_service_1.ResultService.getResultBySampleId(sampleId);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Result template retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    /** Every test on the same visit as this sample, one sheet each. */
    static getVisitBySampleId = async (req, res, next) => {
        try {
            const sampleId = Array.isArray(req.params.sampleId) ? req.params.sampleId[0] : req.params.sampleId;
            const sheets = await result_service_1.ResultService.getVisitBySampleId(sampleId);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `${sheets.length} test sheet(s) retrieved for this visit`,
                data: sheets,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getById = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await result_service_1.ResultService.getResultById(id);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Result details retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static verifyResult = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const currentUser = req.user;
            const result = await result_service_1.ResultService.verifyResult(id, req.body, currentUser);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `Result verification action '${req.body.action}' processed successfully`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static downloadPDF = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const pdfBuffer = await result_service_1.ResultService.generatePDFReport(id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Lab_Report_${id}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ResultController = ResultController;
