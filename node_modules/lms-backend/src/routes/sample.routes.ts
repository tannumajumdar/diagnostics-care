import { Router } from 'express';
import { SampleController } from '../controllers/sample.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { updateSampleStatusSchema, rejectSampleSchema } from '../validators/sample.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.SAMPLE_VIEW), SampleController.getAll);
router.get('/stats', requirePermission(PERMISSIONS.SAMPLE_VIEW), SampleController.getDashboardStats);
router.get('/barcode/:barcode', requirePermission(PERMISSIONS.SAMPLE_VIEW), SampleController.getByBarcode);
router.get('/:id/timeline', requirePermission(PERMISSIONS.SAMPLE_VIEW), SampleController.getTimeline);
router.get('/:id', requirePermission(PERMISSIONS.SAMPLE_VIEW), SampleController.getById);

// The stage a sample may be moved into is enforced per role inside the
// service; this only gates who may touch the bench at all.
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.SAMPLE_COLLECT, PERMISSIONS.SAMPLE_PROCESS),
  validateRequest(updateSampleStatusSchema),
  SampleController.updateStatus
);
router.patch(
  '/:id/reject',
  requirePermission(PERMISSIONS.SAMPLE_REJECT),
  validateRequest(rejectSampleSchema),
  SampleController.rejectSample
);
router.patch('/:id/recollect', requirePermission(PERMISSIONS.SAMPLE_REJECT), SampleController.recollectSample);

export default router;
