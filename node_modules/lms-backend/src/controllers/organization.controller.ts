import { Request, Response, NextFunction } from 'express';
import { repo, regexAny, mongoSort } from '../db/repo';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

export class OrganizationController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, page = 1, limit = 10 } = req.query;
      const filter: any = { AND: [] };
      if (search) {
        filter.AND.push(await regexAny('organization', ['organizationName', 'contactPerson', 'mobile'], String(search)));
      }
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [organizations, total] = await Promise.all([
        repo.find('organization', {
          where: filter,
          orderBy: mongoSort('organization', { organizationName: 1 }),
          skip,
          take: Number(limit),
        }),
        repo.count('organization', filter),
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
      const org = await repo.findById('organization', id);
      if (!org) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Organization retrieved', data: org });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await repo.create('organization', req.body);
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Organization created', data: org });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const org = await repo.updateById('organization', id, req.body);
      if (!org) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Organization updated', data: org });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const found = await repo.findById('organization', id);
      if (!found) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Organization not found');
      found.status = found.status === 'Active' ? 'Inactive' : 'Active';
      const org = await repo.save('organization', found);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: org });
    } catch (error) {
      next(error);
    }
  };
}

