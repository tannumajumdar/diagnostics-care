import { Request, Response, NextFunction } from 'express';
import { SavedReportService } from '../services/savedReport.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

const idParam = (req: Request, key = 'id') => {
  const value = (req.params as any)[key];
  return Array.isArray(value) ? value[0] : value;
};

export class SavedReportController {
  static save = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const data = await SavedReportService.saveFromResult(idParam(req, 'resultId'), currentUser, {
        provisional: req.body?.provisional === true,
      });
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Report saved', data });
    } catch (error) {
      next(error);
    }
  };

  static list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await SavedReportService.list(req.query as any);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Saved reports retrieved',
        data: result.reports,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static file = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { buffer, fileName } = await SavedReportService.getFile(idParam(req));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
