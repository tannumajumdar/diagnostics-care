import { Request, Response, NextFunction } from 'express';
import { ResultService } from '../services/result.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class ResultController {
  static saveDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await ResultService.saveDraft(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Result draft saved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static submitResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await ResultService.submitResult(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Result submitted for Pathologist verification',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getPendingVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ResultService.getPendingVerification(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Pending verification queue retrieved',
        data: result.results,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getPatientReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ResultService.getPatientReports(req.query as any);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Patient reports retrieved',
        data: result.reports,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await ResultService.getAllResults(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Results retrieved successfully',
        data: result.results,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getBySampleId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sampleId = Array.isArray(req.params.sampleId) ? req.params.sampleId[0] : req.params.sampleId;
      const result = await ResultService.getResultBySampleId(sampleId);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Result template retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /** Every test on the same visit as this sample, one sheet each. */
  static getVisitBySampleId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sampleId = Array.isArray(req.params.sampleId) ? req.params.sampleId[0] : req.params.sampleId;
      const sheets = await ResultService.getVisitBySampleId(sampleId);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `${sheets.length} test sheet(s) retrieved for this visit`,
        data: sheets,
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ResultService.getResultById(id);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Result details retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static verifyResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      const result = await ResultService.verifyResult(id, req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Result verification action '${req.body.action}' processed successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static downloadPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pdfBuffer = await ResultService.generatePDFReport(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Lab_Report_${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}

