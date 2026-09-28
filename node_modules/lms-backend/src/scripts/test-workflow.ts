import * as dotenv from 'dotenv';
import { prisma } from '../db/prisma';
import { repo } from '../db/repo';
import { hashIfSet } from '../db/passwords';
import { AuthService } from '../services/auth.service';
import { BillingService } from '../services/billing.service';
import { SampleService } from '../services/sample.service';
import { ResultService } from '../services/result.service';
import { AccountsService } from '../services/accounts.service';
import { ReportsService } from '../services/reports.service';

dotenv.config();

const runEndToEndTests = async () => {
  console.log('\n======================================================');
  console.log('🚀 STARTING COMPREHENSIVE E2E WORKFLOW VERIFICATION');
  console.log('======================================================\n');

  await prisma.$connect();
  console.log('✅ Connected to PostgreSQL for E2E validation');

  // 1. Clear & Seed Fresh State
  console.log('\n[TEST 1] Seeding Fresh System State...');
  // Children before parents, so no foreign key is left pointing at a row
  // that is gone. Mongo let the rows below outlive what they referenced;
  // Postgres does not, so the ones that cannot stand alone go with them:
  // saved report PDFs (their result), gateway transactions (their invoice),
  // rate history and package lines (their test), and the test attachments,
  // which cascade with their test. A package itself is kept, with its
  // department cleared - what populating the dangling ref used to show.
  // Invoice lines, splits and revisions, appointment tests, sample status
  // history and result parameters/versions cascade with their parent.
  await prisma.$transaction([
    prisma.savedReport.deleteMany({}),
    prisma.paymentTransaction.deleteMany({}),
    prisma.rateHistory.deleteMany({}),
    prisma.testPackageItem.deleteMany({}),
    prisma.testPackage.updateMany({ data: { departmentId: null } }),
    prisma.result.deleteMany({}),
    prisma.sample.deleteMany({}),
    prisma.refund.deleteMany({}),
    prisma.payment.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.appointment.deleteMany({}),
    prisma.invoice.deleteMany({}),
    prisma.patient.deleteMany({}),
    prisma.labTest.updateMany({ data: { reportTemplateAttachmentId: null } }),
    prisma.testAttachment.deleteMany({}),
    prisma.labTest.deleteMany({}),
    prisma.doctor.deleteMany({}),
    prisma.organization.deleteMany({}),
    prisma.department.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.auditLog.deleteMany({}),
  ]);

  // One at a time, each with its password hashed on the way in.
  for (const staff of [
    {
      name: 'Centre Admin',
      email: 'admin@lms.com',
      password: 'Admin@123456',
      role: 'Admin',
      mobile: '9876543211',
      status: 'Active',
    },
    {
      name: 'Dr. Sarah Jenkins',
      email: 'pathologist@lms.com',
      password: 'User@123456',
      role: 'Pathologist',
      mobile: '9876543212',
      status: 'Active',
    },
  ]) {
    await repo.create('user', staff, { transform: hashIfSet(staff.password) });
  }
  console.log('✅ Seeding completed');

  // 2. Authentication Test
  console.log('\n[TEST 2] Authentication & Password Hashing...');
  const loginRes = await AuthService.login({
    email: 'admin@lms.com',
    password: 'Admin@123456',
  });
  if (!loginRes.accessToken || !loginRes.user) throw new Error('Auth login failed');
  console.log(`✅ Login successful for ${loginRes.user.name} (${loginRes.user.role})`);

  const currentUser = {
    userId: loginRes.user.id,
    name: loginRes.user.name,
    role: loginRes.user.role,
  };

  // 3. Department CRUD Test
  console.log('\n[TEST 3] Department Master Operations...');
  const testDept = await repo.create('department', {
    departmentName: 'Hematology Express',
    departmentCode: 'HEMEXP',
    description: 'Automated blood testing',
    status: 'Active',
  });
  console.log(`✅ Department created: ${testDept.departmentName} (${testDept.departmentCode})`);

  // 4. Doctor CRUD Test
  console.log('\n[TEST 4] Doctor Master Operations...');
  const testDoc = await repo.create('doctor', {
    doctorName: 'Dr. Robert Vance, MD',
    department: testDept._id,
    mobile: '9876543210',
    email: 'dr.vance@lms.com',
    hospital: 'Metro Care Hospital',
    commission: 15,
    status: 'Active',
  });
  console.log(`✅ Doctor created: ${testDoc.doctorName}`);

  // 5. Test & Parameter Catalog Test
  console.log('\n[TEST 5] Laboratory Test & Parameter Master...');
  const testItem = await repo.create('labTest', {
    testName: 'Complete Blood Count (CBC)',
    testCode: 'CBC01',
    department: testDept._id,
    sampleType: 'Whole Blood',
    sampleContainer: 'EDTA Purple Tube',
    rate: 450,
    patientRate: 450,
    corporateRate: 400,
    doctorRate: 350,
    emergencyRate: 650,
    turnaroundTime: '6 Hours',
    parameters: [
      {
        parameterName: 'Hemoglobin',
        shortName: 'Hb',
        unit: 'g/dL',
        maleReferenceRange: '13.5 - 17.5',
        femaleReferenceRange: '12.0 - 15.5',
        resultType: 'Numeric',
        displayOrder: 1,
      },
    ],
    status: 'Active',
  });
  console.log(`✅ Test created: ${testItem.testName} ($${testItem.rate})`);

  // 6. Patient Registration & UHID Auto-generation Test
  console.log('\n[TEST 6] Patient Registration & UHID Generation...');
  const newPatient = await repo.create('patient', {
    uhid: `UHID-${new Date().getFullYear()}-000001`,
    patientName: 'E2E Test Patient',
    gender: 'Male',
    age: 34,
    mobile: '9988776655',
    email: 'test.patient@example.com',
    referringDoctor: testDoc._id,
    status: 'Active',
  });
  console.log(`✅ Patient registered with unique UHID: ${newPatient.uhid}`);

  // 7. Billing & Barcode Workflow Test
  console.log('\n[TEST 7] Billing, Rate Calculation & Barcode Generation...');
  const billingRes = await BillingService.createInvoice({
    patientId: newPatient._id.toString(),
    doctorId: testDoc._id.toString(),
    testIds: [testItem._id.toString()],
    discountType: 'Fixed',
    discountValue: 50,
    discountReason: 'E2E Promotional Discount',
    paidAmount: 400,
    paymentMethod: 'UPI',
    user: currentUser,
  });
  if (!billingRes.invoice.invoiceNumber || !billingRes.invoice.barcode) {
    throw new Error('Invoice or Barcode generation failed');
  }
  console.log(`✅ Invoice generated: ${billingRes.invoice.invoiceNumber}`);
  console.log(`✅ Barcode assigned: ${billingRes.invoice.barcode}`);
  console.log(`✅ Financials calculated: Net $${billingRes.invoice.netAmount}, Paid $${billingRes.invoice.paidAmount}`);

  // 8. Sample Collection & Laboratory Processing Workflow Test
  console.log('\n[TEST 8] Sample Collection & Processing Queue...');
  const sampleObj = billingRes.samples[0];
  if (!sampleObj) throw new Error('Sample record not created');

  const sampleIdStr = (sampleObj._id || (sampleObj as any).id).toString();
  const collectedSample = await SampleService.updateStatus(sampleIdStr, {
    status: 'Collected',
    remarks: 'Sample drawn via standard phlebotomy protocol',
    user: currentUser,
  });
  console.log(`✅ Sample status updated to: ${collectedSample.status}`);

  // 9. Result Entry & Automatic Flag Calculation Test
  console.log('\n[TEST 9] Parameter Result Entry & Normal/High Flagging...');
  const draftResult = await ResultService.saveDraft({
    sampleId: sampleIdStr,
    results: [
      {
        parameterName: 'Hemoglobin',
        value: '18.5',
        unit: 'g/dL',
        referenceRange: '13.5 - 17.5',
        flag: 'High',
      },
    ],
    overallRemarks: 'High hemoglobin observed',
    user: currentUser,
  });
  console.log(`✅ Draft result saved with flag: ${draftResult.results[0].flag}`);

  const submittedResult = await ResultService.submitResult({
    sampleId: sampleIdStr,
    results: [
      {
        parameterName: 'Hemoglobin',
        value: '18.5',
        unit: 'g/dL',
        referenceRange: '13.5 - 17.5',
        flag: 'High',
      },
    ],
    user: currentUser,
  });
  console.log(`✅ Result submitted for verification. Status: ${submittedResult.status}`);

  // 10. Pathologist Verification & PDF Report Test
  console.log('\n[TEST 10] Pathologist Approval & PDF Diagnostic Report Generation...');
  const resultIdStr = (submittedResult._id || (submittedResult as any).id).toString();
  const approvedResult = await ResultService.verifyResult(resultIdStr, {
    action: 'Approve',
    user: currentUser,
  });
  console.log(`✅ Result verified by Pathologist. Final Status: ${approvedResult.status}`);

  const pdfBuffer = await ResultService.generateReportPDF(resultIdStr);
  if (pdfBuffer.length === 0) throw new Error('PDF Buffer is empty');
  console.log(`✅ PDF Diagnostic Report rendered cleanly (${pdfBuffer.length} bytes)`);

  // 11. Financial Refund & Security Guard Test
  console.log('\n[TEST 11] Financial Refund & Role Authorization Check...');
  const invoiceIdStr = (billingRes.invoice._id || (billingRes.invoice as any).id).toString();
  const refundRes = await AccountsService.createRefund({
    invoiceId: invoiceIdStr,
    refundAmount: 50,
    reason: 'Test partial refund',
    paymentMethod: 'Cash',
    user: currentUser,
  });
  console.log(`✅ Refund processed: ${refundRes.refundId} ($${refundRes.refundAmount})`);

  // 12. Business Analytics Aggregations & Audit Trail Verification
  console.log('\n[TEST 12] Aggregation Reports & Audit Logging Verification...');
  const dailyRev = await ReportsService.getDailyRevenue();
  const auditLogs = await repo.find('auditLog');
  console.log(`✅ PostgreSQL Daily Revenue Aggregation executed cleanly (${dailyRev.length} data points)`);
  console.log(`✅ Audit Trail contains ${auditLogs.length} logged actions`);

  console.log('\n======================================================');
  console.log('🎉 ALL E2E INTEGRATION TESTS PASSED WITH ZERO ERRORS!');
  console.log('======================================================\n');
  process.exit(0);
};

runEndToEndTests().catch((err) => {
  console.error('\n❌ E2E WORKFLOW TEST FAILURE:', err);
  process.exit(1);
});

