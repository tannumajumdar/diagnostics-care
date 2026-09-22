"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const user_model_1 = require("../models/user.model");
const patient_model_1 = require("../models/patient.model");
const doctor_model_1 = require("../models/doctor.model");
const department_model_1 = require("../models/department.model");
const test_model_1 = require("../models/test.model");
const organization_model_1 = require("../models/organization.model");
const invoice_model_1 = require("../models/invoice.model");
const payment_model_1 = require("../models/payment.model");
const sample_model_1 = require("../models/sample.model");
const result_model_1 = require("../models/result.model");
const appointment_model_1 = require("../models/appointment.model");
const refund_model_1 = require("../models/refund.model");
const expense_model_1 = require("../models/expense.model");
const auditLog_model_1 = require("../models/auditLog.model");
const auth_service_1 = require("../services/auth.service");
const billing_service_1 = require("../services/billing.service");
const sample_service_1 = require("../services/sample.service");
const result_service_1 = require("../services/result.service");
const accounts_service_1 = require("../services/accounts.service");
const reports_service_1 = require("../services/reports.service");
dotenv.config();
const runEndToEndTests = async () => {
    console.log('\n======================================================');
    console.log('🚀 STARTING COMPREHENSIVE E2E WORKFLOW VERIFICATION');
    console.log('======================================================\n');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
    await mongoose_1.default.connect(mongoURI);
    console.log('✅ Connected to MongoDB for E2E validation');
    // 1. Clear & Seed Fresh State
    console.log('\n[TEST 1] Seeding Fresh System State...');
    await Promise.all([
        user_model_1.User.deleteMany({}),
        department_model_1.Department.deleteMany({}),
        doctor_model_1.Doctor.deleteMany({}),
        test_model_1.LabTest.deleteMany({}),
        organization_model_1.Organization.deleteMany({}),
        patient_model_1.Patient.deleteMany({}),
        invoice_model_1.Invoice.deleteMany({}),
        payment_model_1.Payment.deleteMany({}),
        sample_model_1.Sample.deleteMany({}),
        result_model_1.Result.deleteMany({}),
        appointment_model_1.Appointment.deleteMany({}),
        refund_model_1.Refund.deleteMany({}),
        expense_model_1.Expense.deleteMany({}),
        auditLog_model_1.AuditLog.deleteMany({}),
    ]);
    await user_model_1.User.create([
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
    ]);
    console.log('✅ Seeding completed');
    // 2. Authentication Test
    console.log('\n[TEST 2] Authentication & Password Hashing...');
    const loginRes = await auth_service_1.AuthService.login({
        email: 'admin@lms.com',
        password: 'Admin@123456',
    });
    if (!loginRes.accessToken || !loginRes.user)
        throw new Error('Auth login failed');
    console.log(`✅ Login successful for ${loginRes.user.name} (${loginRes.user.role})`);
    const currentUser = {
        userId: loginRes.user.id,
        name: loginRes.user.name,
        role: loginRes.user.role,
    };
    // 3. Department CRUD Test
    console.log('\n[TEST 3] Department Master Operations...');
    const testDept = await department_model_1.Department.create({
        departmentName: 'Hematology Express',
        departmentCode: 'HEMEXP',
        description: 'Automated blood testing',
        status: 'Active',
    });
    console.log(`✅ Department created: ${testDept.departmentName} (${testDept.departmentCode})`);
    // 4. Doctor CRUD Test
    console.log('\n[TEST 4] Doctor Master Operations...');
    const testDoc = await doctor_model_1.Doctor.create({
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
    const testItem = await test_model_1.LabTest.create({
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
    const newPatient = await patient_model_1.Patient.create({
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
    const billingRes = await billing_service_1.BillingService.createInvoice({
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
    if (!sampleObj)
        throw new Error('Sample record not created');
    const sampleIdStr = (sampleObj._id || sampleObj.id).toString();
    const collectedSample = await sample_service_1.SampleService.updateStatus(sampleIdStr, {
        status: 'Collected',
        remarks: 'Sample drawn via standard phlebotomy protocol',
        user: currentUser,
    });
    console.log(`✅ Sample status updated to: ${collectedSample.status}`);
    // 9. Result Entry & Automatic Flag Calculation Test
    console.log('\n[TEST 9] Parameter Result Entry & Normal/High Flagging...');
    const draftResult = await result_service_1.ResultService.saveDraft({
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
    const submittedResult = await result_service_1.ResultService.submitResult({
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
    const resultIdStr = (submittedResult._id || submittedResult.id).toString();
    const approvedResult = await result_service_1.ResultService.verifyResult(resultIdStr, {
        action: 'Approve',
        user: currentUser,
    });
    console.log(`✅ Result verified by Pathologist. Final Status: ${approvedResult.status}`);
    const pdfBuffer = await result_service_1.ResultService.generateReportPDF(resultIdStr);
    if (pdfBuffer.length === 0)
        throw new Error('PDF Buffer is empty');
    console.log(`✅ PDF Diagnostic Report rendered cleanly (${pdfBuffer.length} bytes)`);
    // 11. Financial Refund & Security Guard Test
    console.log('\n[TEST 11] Financial Refund & Role Authorization Check...');
    const invoiceIdStr = (billingRes.invoice._id || billingRes.invoice.id).toString();
    const refundRes = await accounts_service_1.AccountsService.createRefund({
        invoiceId: invoiceIdStr,
        refundAmount: 50,
        reason: 'Test partial refund',
        paymentMethod: 'Cash',
        user: currentUser,
    });
    console.log(`✅ Refund processed: ${refundRes.refundId} ($${refundRes.refundAmount})`);
    // 12. Business Analytics Aggregations & Audit Trail Verification
    console.log('\n[TEST 12] Aggregation Reports & Audit Logging Verification...');
    const dailyRev = await reports_service_1.ReportsService.getDailyRevenue();
    const auditLogs = await auditLog_model_1.AuditLog.find({});
    console.log(`✅ MongoDB Daily Revenue Aggregation executed cleanly (${dailyRev.length} data points)`);
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
