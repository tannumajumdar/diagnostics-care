import { Request, Response, NextFunction } from 'express';
import { PaymentGatewayService } from '../services/paymentGateway.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class PaymentGatewayController {
  static initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const data = await PaymentGatewayService.initiate(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message:
          data.method === 'UPI'
            ? 'UPI collection request raised'
            : 'Amount sent to the card terminal',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  static getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await PaymentGatewayService.getStatus(String(req.params.txnId));
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Payment attempt status', data });
    } catch (error) {
      next(error);
    }
  };

  /** The simulator's endpoint - see the note on the route. */
  static simulate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, outcome, reason, cardLast4, cardNetwork, vpa } = req.body;
      const data = await PaymentGatewayService.simulate(String(req.params.txnId), token, outcome, {
        reason,
        cardLast4,
        cardNetwork,
        vpa,
      });
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Payer responded', data });
    } catch (error) {
      next(error);
    }
  };

  static cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await PaymentGatewayService.cancel(String(req.params.txnId));
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Payment attempt cancelled', data });
    } catch (error) {
      next(error);
    }
  };

  static listForInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await PaymentGatewayService.listForInvoice(String(req.params.invoiceId));
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Payment attempts retrieved', data });
    } catch (error) {
      next(error);
    }
  };
}
