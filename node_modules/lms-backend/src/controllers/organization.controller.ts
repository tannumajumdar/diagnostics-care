import { Request, Response, NextFunction } from 'express';
import { Organization } from '../models/organization.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

export class OrganizationController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { organizationName: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
        ];
      }
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [organizations, total] = await Promise.all([
        Organization.find(filter).sort({ organizationName: 1 }).skip(skip).limit(Number(limit)),
        Organization.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Organizations retrieved',
        data: organizations,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const org = await Organization.findById(id);
      if (!org) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Organization retrieved', data: org });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await Organization.create(req.body);
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Organization created', data: org });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const org = await Organization.findByIdAndUpdate(id, req.body, { new: true });
      if (!org) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Organization updated', data: org });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const org = await Organization.findById(id);
      if (!org) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      org.status = org.status === 'Active' ? 'Inactive' : 'Active';
      await org.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: org });
    } catch (error) {
      next(error);
    }
  };
}

