"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentService = void 0;
const appointment_model_1 = require("../models/appointment.model");
const counter_model_1 = require("../models/counter.model");
const notification_service_1 = require("./notification.service");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
class AppointmentService {
    static async createAppointment(payload) {
        const { patientId, patientName, mobile, doctorId, testIds = [], date, time, collectionType, address = '', notes = '', } = payload;
        const appointmentId = await (0, counter_model_1.getNextAppointmentId)();
        const appointment = await appointment_model_1.Appointment.create({
            appointmentId,
            patient: patientId || undefined,
            patientName,
            mobile,
            doctor: doctorId || undefined,
            tests: testIds,
            date: new Date(date),
            time,
            collectionType,
            address,
            status: 'Pending',
            notes,
        });
        // Trigger confirmation notification
        notification_service_1.NotificationService.sendNotification({
            recipient: mobile,
            mobile,
            patientName,
            event: 'APPOINTMENT_CONFIRMED',
            data: { appointmentId, date, time, collectionType },
        });
        return appointment;
    }
    static async getAll(query) {
        const { search, collectionType, status, phlebotomistId, page = 1, limit = 10 } = query;
        const filter = {};
        if (collectionType)
            filter.collectionType = collectionType;
        if (status)
            filter.status = status;
        if (phlebotomistId)
            filter['phlebotomist.userId'] = phlebotomistId;
        if (search) {
            filter.$or = [
                { appointmentId: { $regex: search, $options: 'i' } },
                { patientName: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } },
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [appointments, total] = await Promise.all([
            appointment_model_1.Appointment.find(filter)
                .populate('patient')
                .populate('doctor')
                .populate('tests')
                .sort({ date: 1, time: 1 })
                .skip(skip)
                .limit(Number(limit)),
            appointment_model_1.Appointment.countDocuments(filter),
        ]);
        return {
            appointments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }
    static async getById(id) {
        const apt = await appointment_model_1.Appointment.findById(id)
            .populate('patient')
            .populate('doctor')
            .populate('tests');
        if (!apt) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Appointment not found');
        }
        return apt;
    }
    static async assignPhlebotomist(id, phlebotomist) {
        const apt = await appointment_model_1.Appointment.findById(id);
        if (!apt) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Appointment not found');
        }
        apt.phlebotomist = phlebotomist;
        apt.status = 'Assigned';
        await apt.save();
        return apt;
    }
    static async updateStatus(id, status, notes) {
        const apt = await appointment_model_1.Appointment.findById(id);
        if (!apt) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Appointment not found');
        }
        apt.status = status;
        if (notes)
            apt.notes = notes;
        await apt.save();
        if (status === 'Collected') {
            notification_service_1.NotificationService.sendNotification({
                recipient: apt.mobile,
                mobile: apt.mobile,
                patientName: apt.patientName,
                event: 'SAMPLE_COLLECTED',
                data: { appointmentId: apt.appointmentId },
            });
        }
        return apt;
    }
}
exports.AppointmentService = AppointmentService;
