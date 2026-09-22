"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentController = void 0;
const appointment_service_1 = require("../services/appointment.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
class AppointmentController {
    static create = async (req, res, next) => {
        try {
            const result = await appointment_service_1.AppointmentService.createAppointment(req.body);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: 'Appointment booked successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAll = async (req, res, next) => {
        try {
            const result = await appointment_service_1.AppointmentService.getAll(req.query);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Appointments retrieved',
                data: result.appointments,
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
            const result = await appointment_service_1.AppointmentService.getById(id);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Appointment details retrieved',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static assignPhlebotomist = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await appointment_service_1.AppointmentService.assignPhlebotomist(id, req.body);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Phlebotomist assigned successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static updateStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await appointment_service_1.AppointmentService.updateStatus(id, req.body.status, req.body.notes);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Appointment status updated',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.AppointmentController = AppointmentController;
