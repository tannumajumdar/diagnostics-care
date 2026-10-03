import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import departmentRoutes from './department.routes';
import doctorRoutes from './doctor.routes';
import testRoutes from './test.routes';
import packageRoutes from './package.routes';
import organizationRoutes from './organization.routes';
import patientRoutes from './patient.routes';
import billingRoutes from './billing.routes';
import paymentGatewayRoutes from './paymentGateway.routes';
import sampleRoutes from './sample.routes';
import resultRoutes from './result.routes';
import appointmentRoutes from './appointment.routes';
import accountsRoutes from './accounts.routes';
import refundPolicyRoutes from './refundPolicy.routes';
import reportsRoutes from './reports.routes';
import auditRoutes from './audit.routes';
import rolePermissionRoutes from './rolePermission.routes';
import savedReportRoutes from './savedReport.routes';
import abdmRoutes from './abdm.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Laboratory Management System API is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/tests', testRoutes);
router.use('/packages', packageRoutes);
router.use('/organizations', organizationRoutes);
router.use('/patients', patientRoutes);
router.use('/billing', billingRoutes);
// UPI and card collections, which are an attempt before they are a payment.
router.use('/payment-gateway', paymentGatewayRoutes);
router.use('/samples', sampleRoutes);
router.use('/results', resultRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/accounts', accountsRoutes);
// The centre's return policy, and cancelling a test against it.
router.use('/refund-policy', refundPolicyRoutes);
router.use('/reports', reportsRoutes);
router.use('/audit-logs', auditRoutes);
// Which role may do what, as the Admin set it.
router.use('/role-permissions', rolePermissionRoutes);
// Every report PDF that was saved, kept to download again.
router.use('/saved-reports', savedReportRoutes);
// ABHA verification and creation through ABDM (Milestone 1).
router.use('/abdm', abdmRoutes);

export default router;
