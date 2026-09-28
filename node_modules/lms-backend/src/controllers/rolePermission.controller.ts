import { Request, Response, NextFunction } from 'express';
import { RolePermissionService } from '../services/rolePermission.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

const roleParam = (req: Request) =>
  decodeURIComponent(Array.isArray(req.params.role) ? req.params.role[0] : req.params.role);

export class RolePermissionController {
  static getMatrix = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await RolePermissionService.getMatrix();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Role permissions retrieved', data });
    } catch (error) {
      next(error);
    }
  };

  static updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const data = await RolePermissionService.updateRole(roleParam(req), req.body?.permissions, currentUser);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Permissions saved', data });
    } catch (error) {
      next(error);
    }
  };

  static resetRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await RolePermissionService.resetRole(roleParam(req));
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Permissions reset to default', data });
    } catch (error) {
      next(error);
    }
  };
}
