"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientController = void 0;
const patient_model_1 = require("../models/patient.model");
const invoice_model_1 = require("../models/invoice.model");
const payment_model_1 = require("../models/payment.model");
const sample_model_1 = require("../models/sample.model");
const counter_model_1 = require("../models/counter.model");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
const api_error_util_1 = require("../utils/api-error.util");
class PatientController {
    static getAll = async (req, res, next) => {
        try {
            const { search, status, page = 1, limit = 10 } = req.query;
            const filter = {};
            if (search) {
                filter.$or = [
                    { patientName: { $regex: search, $options: 'i' } },
                    { uhid: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } },
                ];
            }
            if (status)
                filter.status = status;
            const skip = (Number(page) - 1) * Number(limit);
            const [patients, total] = await Promise.all([
                patient_model_1.Patient.find(filter).populate('referringDoctor').populate('organization').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
                patient_model_1.Patient.countDocuments(filter),
            ]);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Patients retrieved',
                data: patients,
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
            const patient = await patient_model_1.Patient.findById(id).populate('referringDoctor').populate('organization');
            if (!patient)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Patient not found');
            const invoices = await invoice_model_1.Invoice.find({ patient: patient._id }).sort({ createdAt: -1 });
            const payments = await payment_model_1.Payment.find({ patient: patient._id }).sort({ createdAt: -1 });
            const testHistory = await sample_model_1.Sample.find({ patient: patient._id }).sort({ createdAt: -1 });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Patient profile retrieved',
                data: {
                    patient,
                    invoices,
                    payments,
                    testHistory,
                    reports: [],
                    appointments: [],
                },
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getHistory = async (req, res, next) => {
        return PatientController.getById(req, res, next);
    };
    static create = async (req, res, next) => {
        try {
            const uhid = await (0, counter_model_1.getNextUhid)();
            const patient = await patient_model_1.Patient.create({ ...req.body, uhid });
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.CREATED, message: `Patient ${patient.patientName} registered`, data: patient });
        }
        catch (error) {
            next(error);
        }
    };
    static update = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const patient = await patient_model_1.Patient.findByIdAndUpdate(id, req.body, { new: true });
            if (!patient)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Patient not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Patient updated', data: patient });
        }
        catch (error) {
            next(error);
        }
    };
    static toggleStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const patient = await patient_model_1.Patient.findById(id);
            if (!patient)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Patient not found');
            patient.status = patient.status === 'Active' ? 'Inactive' : 'Active';
            await patient.save();
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Status updated', data: patient });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.PatientController = PatientController;
