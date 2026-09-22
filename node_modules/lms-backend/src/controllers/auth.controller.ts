import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS, MESSAGES } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';
import { logAuditAction } from '../utils/auditLogger';

export class AuthController {
  static login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });

      logAuditAction({
        action: 'LOGIN',
        module: 'AUTH',
        user: { id: (result.user._id || result.user.id).toString(), name: result.user.name, role: result.user.role },
        ipAddress: req.ip,
        details: { email },
      });

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: MESSAGES.AUTH.LOGIN_SUCCESS,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshToken(refreshToken);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const user = await AuthService.getCurrentUser(currentUser.userId);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Current user profile retrieved',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  static changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const { oldPassword, newPassword } = req.body;
      await AuthService.changePassword(currentUser.userId, oldPassword, newPassword);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  static logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      if (currentUser?.userId) {
        await AuthService.logout(currentUser.userId);
      }
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: MESSAGES.AUTH.LOGOUT_SUCCESS,
      });
    } catch (error) {
      next(error);
    }
  };
}
