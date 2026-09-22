import { Request, Response, NextFunction } from 'express';
import { SampleService } from '../services/sample.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class SampleController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await SampleService.getAllSamples(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Samples retrieved',
        data: result.samples,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await SampleService.getById(id);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample retrieved', data: result });
    } catch (error) {
      next(error);
    }
  };

  static getByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
      const result = await SampleService.getByBarcode(barcode);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample barcode retrieved', data: result });
    } catch (error) {
      next(error);
    }
  };

  static getDashboardStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await SampleService.getDashboardStats();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample dashboard stats', data: stats });
    } catch (error) {
      next(error);
    }
  };

  static updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      const result = await SampleService.updateStatus(id, req.body, currentUser);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample status updated', data: result });
    } catch (error) {
      next(error);
    }
  };

  static rejectSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      const result = await SampleService.rejectSample(id, req.body, currentUser);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample rejected', data: result });
    } catch (error) {
      next(error);
    }
  };

  static recollectSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      // currentUser was previously passed as the payload, so the audit entry
      // never recorded who ordered the repeat draw.
      const result = await SampleService.recollectSample(id, req.body, currentUser);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Repeat draw queued', data: result });
    } catch (error) {
      next(error);
    }
  };

  static getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await SampleService.getTimeline(id);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample timeline retrieved', data: result });
    } catch (error) {
      next(error);
    }
  };
}

