import { Request, Response, NextFunction } from 'express';
import { AbdmService } from '../services/abdm.service';
import { AbdmDemo, abdmMode, DEMO_OTP } from '../services/abdm.demo';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';

/** ABDM itself, or the local stand-in while there are no credentials. */
const abdm = (): typeof AbdmService => (abdmMode() === 'demo' ? AbdmDemo : AbdmService);

/** Each step of the ABDM journeys is one call; the reply is ABDM's, reshaped. */
const step =
  (message: string, run: (body: any, query: any) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await run(req.body, req.query);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: (data as any)?.message || message, data });
    } catch (error) {
      next(error);
    }
  };

export class AbdmController {
  /** Whether the dialog is talking to ABDM, to the demo, or to nothing. */
  static status = step('ABDM status', async () => {
    const mode = abdmMode();
    return { mode, ...(mode === 'demo' ? { demoOtp: DEMO_OTP } : {}) };
  });

  static loginOtp = step('OTP sent', (b) => abdm().loginRequestOtp(b.method, b.value));
  static loginVerify = step('ABHA verified', (b) => abdm().loginVerifyOtp(b.method, b.txnId, b.otp));
  static loginPick = step('ABHA verified', (b) => abdm().loginPickAccount(b.txnId, b.abhaNumber));

  static enrolOtp = step('OTP sent', (b) => abdm().enrolRequestOtp(b.aadhaar));
  static enrolVerify = step('Aadhaar verified', (b) => abdm().enrolVerifyOtp(b.txnId, b.otp, b.mobile));
  static enrolMobileOtp = step('OTP sent', (b) => abdm().enrolMobileOtp(b.txnId, b.mobile));
  static enrolMobileVerify = step('Mobile verified', (b) => abdm().enrolMobileVerify(b.txnId, b.otp));
  static enrolSuggestions = step('ABHA address suggestions', (_b, q) => abdm().enrolSuggestions(String(q.txnId)));
  static enrolAddress = step('ABHA created', (b) => abdm().enrolSetAddress(b.txnId, b.abhaAddress));
  static enrolProfile = step('ABHA profile', async (b) => ({ profile: await abdm().enrolProfile(b.txnId) }));
}
