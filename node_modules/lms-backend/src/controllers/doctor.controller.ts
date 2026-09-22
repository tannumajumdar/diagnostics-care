import { Request, Response, NextFunction } from 'express';
import { Doctor } from '../models/doctor.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

export class DoctorController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        search,
        department,
        status,
        area,
        dateField = 'createdAt',
        fromDate,
        toDate,
        sortBy = 'createdAt',
        sortDir = 'desc',
        page = 1,
        limit = 10,
      } = req.query;

      const filter: any = {};
      if (search) {
        filter.$or = [
          { doctorName: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { hospital: { $regex: search, $options: 'i' } },
          { degree: { $regex: search, $options: 'i' } },
          { specialty: { $regex: search, $options: 'i' } },
          { area: { $regex: search, $options: 'i' } },
        ];
      }
      if (department) filter.department = department;
      if (status) filter.status = status;
      if (area) filter.area = { $regex: area, $options: 'i' };

      // Date range, filtered on either entry date or date of birth so the list
      // can answer "registered this week" and "birthdays this month" alike.
      const dateKey = String(dateField) === 'dob' ? 'dob' : 'createdAt';
      if (fromDate || toDate) {
        filter[dateKey] = {};
        if (fromDate) filter[dateKey].$gte = new Date(String(fromDate));
        if (toDate) {
          const end = new Date(String(toDate));
          end.setHours(23, 59, 59, 999); // inclusive of the whole TO DATE day
          filter[dateKey].$lte = end;
        }
      }

      const allowedSort = ['createdAt', 'doctorName', 'commission', 'discountPercentage', 'dob'];
      const sortKey = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const sort: any = { [sortKey]: String(sortDir) === 'asc' ? 1 : -1 };

      const skip = (Number(page) - 1) * Number(limit);
      const [doctors, total] = await Promise.all([
        Doctor.find(filter)
          .populate('department')
          .populate('addedBy', 'name email role')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit)),
        Doctor.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Doctors retrieved',
        data: doctors,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await Doctor.findById(id).populate('department');
      if (!doc) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Doctor details retrieved', data: doc });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await Doctor.create({ ...req.body, addedBy: req.user?.userId });
      await doc.populate('department');
      await doc.populate('addedBy', 'name email role');
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Doctor registered', data: doc });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk "Set Cut Value" - applies a commission (and optionally a discount
   * percentage) to every selected doctor in one write.
   */
  static setCutValue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, commission, discountPercentage } = req.body as {
        ids?: string[];
        commission?: number;
        discountPercentage?: number;
      };

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Select at least one doctor');
      }

      const update: Record<string, number> = {};
      if (commission !== undefined) {
        if (Number.isNaN(Number(commission)) || Number(commission) < 0 || Number(commission) > 100) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Commission must be between 0 and 100');
        }
        update.commission = Number(commission);
      }
      if (discountPercentage !== undefined) {
        if (
          Number.isNaN(Number(discountPercentage)) ||
          Number(discountPercentage) < 0 ||
          Number(discountPercentage) > 100
        ) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Discount must be between 0 and 100');
        }
        update.discountPercentage = Number(discountPercentage);
      }

      if (Object.keys(update).length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Provide a commission or discount value to apply');
      }

      const result = await Doctor.updateMany({ _id: { $in: ids } }, { $set: update });
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Cut value applied to ${result.modifiedCount} doctor(s)`,
        data: { matched: result.matchedCount, modified: result.modifiedCount, applied: update },
      });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await Doctor.findByIdAndUpdate(id, req.body, { new: true });
      if (!doc) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Doctor updated', data: doc });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await Doctor.findById(id);
      if (!doc) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      doc.status = doc.status === 'Active' ? 'Inactive' : 'Active';
      await doc.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: doc });
    } catch (error) {
      next(error);
    }
  };
}

