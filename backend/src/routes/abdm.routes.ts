import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AbdmController } from '../controllers/abdm.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import {
  loginOtpSchema,
  loginVerifySchema,
  loginPickSchema,
  enrolOtpSchema,
  enrolVerifySchema,
  enrolMobileOtpSchema,
  enrolMobileVerifySchema,
  enrolAddressSchema,
  enrolTxnSchema,
} from '../validators/abdm.validator';

const router = Router();

// ABHA is looked up and made from the registration desk, so the patient
// permissions guard it like the rest of the patient record.
router.use(authenticate, requirePermission(PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_EDIT));

// Every OTP is an SMS to a patient; a stuck button must not send dozens.
const otpLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests - wait a few minutes' },
});

// Live ABDM, the demo stand-in, or neither - the dialog says which.
router.get('/status', AbdmController.status);

// Verifying an ABHA the patient already has.
router.post('/login/otp', otpLimiter, validateRequest(loginOtpSchema), AbdmController.loginOtp);
router.post('/login/verify', validateRequest(loginVerifySchema), AbdmController.loginVerify);
router.post('/login/account', validateRequest(loginPickSchema), AbdmController.loginPick);

// Creating one from Aadhaar.
router.post('/enrol/otp', otpLimiter, validateRequest(enrolOtpSchema), AbdmController.enrolOtp);
router.post('/enrol/verify', validateRequest(enrolVerifySchema), AbdmController.enrolVerify);
router.post('/enrol/mobile/otp', otpLimiter, validateRequest(enrolMobileOtpSchema), AbdmController.enrolMobileOtp);
router.post('/enrol/mobile/verify', validateRequest(enrolMobileVerifySchema), AbdmController.enrolMobileVerify);
router.get('/enrol/suggestions', AbdmController.enrolSuggestions);
router.post('/enrol/address', validateRequest(enrolAddressSchema), AbdmController.enrolAddress);
router.post('/enrol/profile', validateRequest(enrolTxnSchema), AbdmController.enrolProfile);

export default router;
