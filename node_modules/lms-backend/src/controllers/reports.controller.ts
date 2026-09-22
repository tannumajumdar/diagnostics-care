import { Request, Response, NextFunction } from 'express';
import { ReportsService } from '../services/reports.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';

export class ReportsController {
  static getDailyRevenue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getDailyRevenueTrend();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Daily revenue trend', data });
    } catch (error) {
      next(error);
    }
  };

  static getMonthlyRevenue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getMonthlyRevenueTrend();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Monthly revenue trend', data });
    } catch (error) {
      next(error);
    }
  };

  static getPatientRegistrations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getPatientRegistrationTrend();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Patient registration trend', data });
    } catch (error) {
      next(error);
    }
  };

  static getTestWiseRevenue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getTestWiseRevenue();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test-wise revenue & volume', data });
    } catch (error) {
      next(error);
    }
  };

  static getDepartmentWiseTests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getDepartmentWiseTests();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Department-wise test volume', data });
    } catch (error) {
      next(error);
    }
  };

  static getDoctorWiseTests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getDoctorWiseTests();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Doctor referral volume', data });
    } catch (error) {
      next(error);
    }
  };

  static getPaymentMethods = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getPaymentMethodDistribution();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Payment method breakdown', data });
    } catch (error) {
      next(error);
    }
  };

  static getPendingDuePayments = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getPendingDuePayments();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Pending due payments', data });
    } catch (error) {
      next(error);
    }
  };

  static getReportCompletionStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getReportCompletionStats();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Report status stats', data });
    } catch (error) {
      next(error);
    }
  };

  static getSampleRejectionAnalytics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getSampleRejectionAnalytics();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Sample rejection reasons', data });
    } catch (error) {
      next(error);
    }
  };

  static getCorporateRevenue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportsService.getCorporateRevenue();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Corporate TPA revenue', data });
    } catch (error) {
      next(error);
    }
  };
}
