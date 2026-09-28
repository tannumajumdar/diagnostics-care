import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { repo, regexAny, regexWhere, mongoSort, refFilter, dateFilter } from '../db/repo';
import { assertObjectId } from '../db/ids';
import { decimalsIn } from '../db/mappers';

/** `.populate('addedBy', 'name email role')` */
const ADDED_BY = { addedBy: { select: { id: true, name: true, email: true, role: true } } };
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

      const filter: any = { AND: [] };
      if (search) {
        filter.AND.push(
          await regexAny('doctor', ['doctorName', 'mobile', 'hospital', 'degree', 'specialty', 'area'], String(search))
        );
      }
      if (department) filter.departmentId = refFilter(department, 'department');
      if (status) filter.status = status;
      if (area) filter.AND.push(await regexWhere('doctor', 'area', String(area)));

      // Date range, filtered on either entry date or date of birth so the list
      // can answer "registered this week" and "birthdays this month" alike.
      const dateKey = String(dateField) === 'dob' ? 'dob' : 'createdAt';
      if (fromDate || toDate) {
        filter[dateKey] = {};
        if (fromDate) filter[dateKey].gte = dateFilter(new Date(String(fromDate)), dateKey);
        if (toDate) {
          const end = new Date(String(toDate));
          end.setHours(23, 59, 59, 999); // inclusive of the whole TO DATE day
          filter[dateKey].lte = dateFilter(end, dateKey);
        }
      }

      const allowedSort = ['createdAt', 'doctorName', 'commission', 'discountPercentage', 'dob'];
      const sortKey = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const sort: any = { [sortKey]: String(sortDir) === 'asc' ? 1 : -1 };

      const skip = (Number(page) - 1) * Number(limit);
      const [doctors, total] = await Promise.all([
        repo.find('doctor', {
          where: filter,
          include: { department: true, ...ADDED_BY },
          orderBy: mongoSort('doctor', sort),
          skip,
          take: Number(limit),
        }),
        repo.count('doctor', filter),
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
      const doc = await repo.findById('doctor', id, { include: { department: true } });
      if (!doc) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Doctor details retrieved', data: doc });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await repo.create(
        'doctor',
        { ...req.body, addedBy: req.user?.userId },
        { include: { department: true, ...ADDED_BY } }
      );
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

      const keys = ids.map((id) => assertObjectId(String(id)));
      // Every matched doctor's updatedAt moves with the write, so Mongo
      // counted every match as modified as well.
      const result = await prisma.doctor.updateMany({ where: { id: { in: keys } }, data: decimalsIn('doctor', { ...update }) });
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Cut value applied to ${result.count} doctor(s)`,
        data: { matched: result.count, modified: result.count, applied: update },
      });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await repo.updateById('doctor', id, req.body);
      if (!doc) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Doctor updated', data: doc });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const found = await repo.findById('doctor', id);
      if (!found) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Doctor not found');
      found.status = found.status === 'Active' ? 'Inactive' : 'Active';
      const doc = await repo.save('doctor', found);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: doc });
    } catch (error) {
      next(error);
    }
  };
}

