import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';

export class AppointmentController {
  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AppointmentService.createAppointment(req.body);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Appointment booked successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AppointmentService.getAll(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Appointments retrieved',
        data: result.appointments,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AppointmentService.getById(id);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Appointment details retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static assignPhlebotomist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AppointmentService.assignPhlebotomist(id, req.body);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Phlebotomist assigned successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AppointmentService.updateStatus(id, req.body.status, req.body.notes);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Appointment status updated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
