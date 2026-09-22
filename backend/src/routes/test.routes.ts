import { Router } from 'express';
import { TestController } from '../controllers/test.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { createLabTestSchema, updateLabTestSchema, updateRatesSchema } from '../validators/test.validator';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.MASTER_VIEW), TestController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.MASTER_VIEW), TestController.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.TEST_MANAGE),
  validateRequest(createLabTestSchema),
  TestController.create
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.TEST_MANAGE),
  validateRequest(updateLabTestSchema),
  TestController.update
);
router.patch('/:id/status', requirePermission(PERMISSIONS.TEST_MANAGE), TestController.toggleStatus);
router.delete('/:id', requirePermission(PERMISSIONS.TEST_MANAGE), TestController.remove);
router.put('/:id/parameters', requirePermission(PERMISSIONS.TEST_MANAGE), TestController.updateParameters);
router.put(
  '/:id/rates',
  requirePermission(PERMISSIONS.RATE_MANAGE),
  validateRequest(updateRatesSchema),
  TestController.updateRates
);

export default router;
