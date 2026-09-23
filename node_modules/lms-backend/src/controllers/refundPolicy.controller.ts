import { Request, Response, NextFunction } from 'express';
import { RefundPolicyService } from '../services/refundPolicy.service';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class RefundPolicyController {
  static getPolicy = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await RefundPolicyService.getPolicyForScreen();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Refund policy retrieved', data });
    } catch (error) {
      next(error);
    }
  };

  static updatePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const data = await RefundPolicyService.updatePolicy(req.body, currentUser);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Refund policy saved', data });
    } catch (error) {
      next(error);
    }
  };

  /** What each line on a bill is worth back today. Reads nothing into the books. */
  static getQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
      const data = await RefundPolicyService.quoteForInvoice(invoiceId);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Cancellation quote retrieved', data });
    } catch (error) {
      next(error);
    }
  };

  static cancelTests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const data = await RefundPolicyService.cancelTestsAndRefund(req.body, currentUser);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: data.cashRefund > 0 ? 'Tests cancelled and refund issued' : 'Tests cancelled and the bill adjusted',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
