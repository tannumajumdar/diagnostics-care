import { Request, Response, NextFunction } from 'express';
import { AccountsService } from '../services/accounts.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class AccountsController {
  static getDailyCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const date = req.query.date as string;
      const result = await AccountsService.getDailyCollections(date);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Daily collections retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getCollectionTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, to, days } = req.query as Record<string, string>;
      const result = await AccountsService.getCollectionTrend({ from, to, days });
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Collections by day retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getOverallCollections = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AccountsService.getOverallCollections();
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Overall collections retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static createRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await AccountsService.createRefund(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Refund issued successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAllRefunds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AccountsService.getAllRefunds(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Refunds retrieved',
        data: result.refunds,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static createPayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await AccountsService.createPayout(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message:
          result.status === 'Pending'
            ? `Payout of Rs.${result.amount} to ${result.payeeName} recorded and sent for Admin approval`
            : `Payout of Rs.${result.amount} to ${result.payeeName} recorded`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAllPayouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AccountsService.getAllPayouts(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Payouts retrieved',
        data: result.payouts,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getPayoutSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AccountsService.getPayoutSummary({
        from: req.query.from as string,
        to: req.query.to as string,
      });
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Payout report generated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static updatePayoutStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AccountsService.updatePayoutStatus(id, req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Payout marked ${result.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static deletePayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AccountsService.deletePayout(id, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Payout ${result.expenseId} deleted`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getDoctorCommissionReport = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await AccountsService.getDoctorCommissionReport();
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Doctor commission report generated',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId, search, from, to, paymentMethod, flowType, payeeType, page, limit } = req.query as Record<
        string,
        string
      >;
      const result = await AccountsService.getLedger({
        patientId,
        search,
        from,
        to,
        paymentMethod,
        flowType: flowType as any,
        payeeType,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Payment ledger retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
