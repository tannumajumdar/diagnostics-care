import { Request, Response, NextFunction } from 'express';
import { RolePermissionService } from '../services/rolePermission.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';

export class RolePermissionController {
  static getMatrix = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await RolePermissionService.getMatrix();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Role permissions retrieved', data });
    } catch (error) {
      next(error);
    }
  };
}
