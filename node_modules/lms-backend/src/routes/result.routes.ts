import { Router } from 'express';
import { ResultController } from '../controllers/result.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { saveResultSchema, verifyResultSchema } from '../validators/result.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.RESULT_VIEW), ResultController.getAll);
router.get('/pending', requirePermission(PERMISSIONS.RESULT_VERIFY), ResultController.getPendingVerification);
router.get('/sample/:sampleId', requirePermission(PERMISSIONS.RESULT_VIEW), ResultController.getBySampleId);
// The whole visit's sheets in one call, so the bench types every test the
// patient was billed for without walking back to the queue between them.
router.get('/visit/:sampleId', requirePermission(PERMISSIONS.RESULT_VIEW), ResultController.getVisitBySampleId);
router.get('/:id', requirePermission(PERMISSIONS.RESULT_VIEW), ResultController.getById);
// The front desk hands the printed report to the patient, so any desk that can
// see a bill may pull the released PDF.
router.get('/:id/pdf', requirePermission(PERMISSIONS.RESULT_VIEW, PERMISSIONS.BILL_VIEW), ResultController.downloadPDF);

router.post(
  '/draft',
  requirePermission(PERMISSIONS.RESULT_ENTER),
  validateRequest(saveResultSchema),
  ResultController.saveDraft
);
router.post(
  '/submit',
  requirePermission(PERMISSIONS.RESULT_ENTER),
  validateRequest(saveResultSchema),
  ResultController.submitResult
);
router.patch(
  '/:id/verify',
  requirePermission(PERMISSIONS.RESULT_VERIFY),
  validateRequest(verifyResultSchema),
  ResultController.verifyResult
);

export default router;
