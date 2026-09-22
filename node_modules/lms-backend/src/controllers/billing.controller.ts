import { Request, Response, NextFunction } from 'express';
import { BillingService } from '../services/billing.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class BillingController {
  static createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await BillingService.createInvoice(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: `Invoice ${result.invoice.invoiceNumber} created successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static createVisit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const result = await BillingService.createVisit(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: `Visit registered - invoice ${result.invoice.invoiceNumber}, ${result.samples.length} sample(s) queued`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await BillingService.getAllInvoices(req.query);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Invoices retrieved successfully',
        data: result.invoices,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await BillingService.getInvoiceById(id);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Invoice details retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static getByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
      const result = await BillingService.getByBarcode(barcode);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Invoice retrieved by barcode',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  static addPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      const result = await BillingService.addPayment(id, req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Payment receipt ${result.paymentRecord.receiptNumber} generated successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
