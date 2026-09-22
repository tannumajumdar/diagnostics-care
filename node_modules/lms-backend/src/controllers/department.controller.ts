import { Request, Response, NextFunction } from 'express';
import { Department } from '../models/department.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

export class DepartmentController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { departmentName: { $regex: search, $options: 'i' } },
          { departmentCode: { $regex: search, $options: 'i' } },
        ];
      }
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [departments, total] = await Promise.all([
        Department.find(filter).sort({ departmentName: 1 }).skip(skip).limit(Number(limit)),
        Department.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Departments retrieved',
        data: departments,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const dept = await Department.findById(id);
      if (!dept) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Department not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Department retrieved', data: dept });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dept = await Department.create(req.body);
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Department created', data: dept });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const dept = await Department.findByIdAndUpdate(id, req.body, { new: true });
      if (!dept) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Department not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Department updated', data: dept });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const dept = await Department.findById(id);
      if (!dept) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Department not found');
      dept.status = dept.status === 'Active' ? 'Inactive' : 'Active';
      await dept.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: dept });
    } catch (error) {
      next(error);
    }
  };
}

