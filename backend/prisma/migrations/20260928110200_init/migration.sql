-- A Mongo-style ObjectId: 8 hex digits of Unix seconds, then 16 random hex
-- digits. Every id in the app is one of these, both the ones carried over
-- from Mongo and the ones minted here, so ids stay 24-hex and sort in the
-- order the rows were created.
CREATE FUNCTION gen_object_id() RETURNS text AS $$
  SELECT lpad(to_hex(floor(extract(epoch FROM clock_timestamp()))::bigint), 8, '0')
      || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
$$ LANGUAGE sql VOLATILE;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Receptionist',
    "mobile" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "refreshToken" TEXT,
    "permissions" JSONB,
    "sessionsValidFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedByAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT,
    "userRole" TEXT,
    "ipAddress" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "name" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "departmentName" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "doctorName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Male',
    "degree" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "dob" DATE,
    "area" TEXT NOT NULL DEFAULT '',
    "areaCode" TEXT NOT NULL DEFAULT '',
    "hospital" TEXT NOT NULL DEFAULT '',
    "paymentTerm" TEXT NOT NULL DEFAULT 'Monthly',
    "discountType" TEXT NOT NULL DEFAULT 'Percentage',
    "discountPercentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "commission" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "organizationName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "gstNumber" TEXT NOT NULL DEFAULT '',
    "contractRate" TEXT NOT NULL DEFAULT 'Corporate',
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "testName" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "testType" TEXT NOT NULL DEFAULT 'Routine',
    "sampleType" TEXT NOT NULL DEFAULT 'Whole Blood',
    "sampleContainer" TEXT NOT NULL DEFAULT 'EDTA Vial',
    "rate" DECIMAL(65,30) NOT NULL,
    "patientRate" DECIMAL(65,30) NOT NULL,
    "corporateRate" DECIMAL(65,30) NOT NULL,
    "doctorRate" DECIMAL(65,30) NOT NULL,
    "emergencyRate" DECIMAL(65,30) NOT NULL,
    "referralRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "processingMode" TEXT NOT NULL DEFAULT 'In-house',
    "outsourceLab" TEXT NOT NULL DEFAULT '',
    "outsourceCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tpaId" TEXT,
    "discountAllowed" BOOLEAN NOT NULL DEFAULT true,
    "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
    "preparationRequired" TEXT NOT NULL DEFAULT '',
    "turnaroundTime" TEXT NOT NULL DEFAULT '24 Hours',
    "interpretationTitle" TEXT NOT NULL DEFAULT '',
    "interpretation" TEXT NOT NULL DEFAULT '',
    "reportTemplateAttachmentId" TEXT,
    "reportTemplateFileName" TEXT,
    "reportTemplateSize" INTEGER,
    "reportTemplateUploadedAt" TIMESTAMP(3),
    "reportTemplateUploadedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestParameter" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "testId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "parameterName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "maleReferenceRange" TEXT NOT NULL DEFAULT '',
    "femaleReferenceRange" TEXT NOT NULL DEFAULT '',
    "childReferenceRange" TEXT NOT NULL DEFAULT '',
    "criticalLow" TEXT NOT NULL DEFAULT '',
    "criticalHigh" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT '',
    "resultType" TEXT NOT NULL DEFAULT 'Numeric',
    "displayOrder" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "paraFor" TEXT NOT NULL DEFAULT 'ALL',
    "minValue" TEXT NOT NULL DEFAULT '',
    "maxValue" TEXT NOT NULL DEFAULT '',
    "highRange" TEXT NOT NULL DEFAULT '',
    "lowRange" TEXT NOT NULL DEFAULT '',
    "ageFromDays" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ageToDays" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "referenceText" TEXT NOT NULL DEFAULT '',
    "formula" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TestParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttachment" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "testId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reference',
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPackage" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "packageName" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "departmentId" TEXT,
    "rate" DECIMAL(65,30) NOT NULL,
    "referralRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAllowed" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestPackageItem" (
    "packageId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TestPackageItem_pkey" PRIMARY KEY ("packageId","testId")
);

-- CreateTable
CREATE TABLE "RateHistory" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "testId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "prevRate" DECIMAL(65,30) NOT NULL,
    "prevPatientRate" DECIMAL(65,30) NOT NULL,
    "prevCorporateRate" DECIMAL(65,30) NOT NULL,
    "prevDoctorRate" DECIMAL(65,30) NOT NULL,
    "prevEmergencyRate" DECIMAL(65,30) NOT NULL,
    "prevReferralRate" DECIMAL(65,30),
    "newRate" DECIMAL(65,30) NOT NULL,
    "newPatientRate" DECIMAL(65,30) NOT NULL,
    "newCorporateRate" DECIMAL(65,30) NOT NULL,
    "newDoctorRate" DECIMAL(65,30) NOT NULL,
    "newEmergencyRate" DECIMAL(65,30) NOT NULL,
    "newReferralRate" DECIMAL(65,30),
    "reason" TEXT NOT NULL DEFAULT '',
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundPolicy" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'refund-policy',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stages" JSONB NOT NULL,
    "cancellationFee" DECIMAL(65,30) NOT NULL,
    "refundWindowDays" DECIMAL(65,30) NOT NULL,
    "fullRefundOnLabRejection" BOOLEAN NOT NULL,
    "allowAdminOverride" BOOLEAN NOT NULL,
    "policyNote" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedByRole" TEXT,
    "updatedByAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "uhid" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "age" DECIMAL(65,30) NOT NULL,
    "mobile" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "pinCode" TEXT NOT NULL DEFAULT '',
    "emergencyContact" TEXT NOT NULL DEFAULT '',
    "referringDoctorId" TEXT,
    "organizationId" TEXT,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "doctorId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL DEFAULT 'Lab Visit',
    "address" TEXT NOT NULL DEFAULT '',
    "phlebotomistUserId" TEXT,
    "phlebotomistName" TEXT,
    "phlebotomistMobile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentTest" (
    "appointmentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AppointmentTest_pkey" PRIMARY KEY ("appointmentId","position")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "enquiryNo" TEXT,
    "patientId" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "referringDoctorId" TEXT,
    "referringDoctorName" TEXT NOT NULL DEFAULT '',
    "organizationId" TEXT,
    "chiefComplaint" TEXT NOT NULL DEFAULT '',
    "clinicalNotes" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'Routine',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'Fixed',
    "discountValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountReason" TEXT NOT NULL DEFAULT '',
    "discountDoctorId" TEXT,
    "discountDoctorName" TEXT NOT NULL DEFAULT '',
    "netAmount" DECIMAL(65,30) NOT NULL,
    "referralTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "barcode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "testId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "lineDiscountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "processingMode" TEXT NOT NULL DEFAULT 'In-house',
    "outsourceLab" TEXT NOT NULL DEFAULT '',
    "referralRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "packageId" TEXT,
    "packageName" TEXT NOT NULL DEFAULT '',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "retainedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cancelledById" TEXT,
    "cancelledByName" TEXT,
    "cancelledByRole" TEXT,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePaymentSplit" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "InvoicePaymentSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceRevision" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT,
    "byName" TEXT,
    "byRole" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "testsAdded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "netBefore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAfter" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "receivedById" TEXT NOT NULL,
    "receivedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "txnId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "vpa" TEXT NOT NULL DEFAULT '',
    "upiIntent" TEXT NOT NULL DEFAULT '',
    "utr" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "cardNetwork" TEXT NOT NULL DEFAULT '',
    "authCode" TEXT NOT NULL DEFAULT '',
    "rrn" TEXT NOT NULL DEFAULT '',
    "payerToken" TEXT NOT NULL,
    "failureReason" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "initiatedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "refundId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "refundAmount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "approvedByRole" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "expenseId" TEXT NOT NULL,
    "payeeType" TEXT NOT NULL DEFAULT 'Other',
    "payeeName" TEXT NOT NULL,
    "payeeContact" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "referenceNo" TEXT NOT NULL DEFAULT '',
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Paid',
    "needsApproval" BOOLEAN NOT NULL DEFAULT false,
    "patientId" TEXT,
    "invoiceId" TEXT,
    "doctorId" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "recordedByRole" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedByRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "receiptUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "sampleId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "enquiryNo" TEXT,
    "invoiceId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "sampleContainer" TEXT NOT NULL,
    "processingMode" TEXT NOT NULL DEFAULT 'In-house',
    "outsourceLab" TEXT NOT NULL DEFAULT '',
    "collectionDate" TIMESTAMP(3),
    "collectionTime" TEXT NOT NULL DEFAULT '',
    "collector" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pending Collection',
    "priority" TEXT NOT NULL DEFAULT 'Routine',
    "chiefComplaint" TEXT NOT NULL DEFAULT '',
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "rejectionRemarks" TEXT NOT NULL DEFAULT '',
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "recollectionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleStatusHistory" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "sampleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "updatedByRole" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SampleStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "resultId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "enquiryNo" TEXT,
    "invoiceId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "overallRemarks" TEXT NOT NULL DEFAULT '',
    "enteredById" TEXT NOT NULL,
    "enteredByName" TEXT NOT NULL,
    "enteredByRole" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedByRole" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultParameter" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "resultId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "parameterId" TEXT,
    "parameterName" TEXT NOT NULL,
    "shortName" TEXT,
    "value" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "referenceRange" TEXT NOT NULL DEFAULT '',
    "flag" TEXT NOT NULL DEFAULT 'Normal',
    "flagManual" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "resultType" TEXT NOT NULL DEFAULT 'Numeric',
    "dropdownOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalLow" TEXT NOT NULL DEFAULT '',
    "criticalHigh" TEXT NOT NULL DEFAULT '',
    "highRange" TEXT NOT NULL DEFAULT '',
    "lowRange" TEXT NOT NULL DEFAULT '',
    "displayOrder" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "formula" TEXT NOT NULL DEFAULT '',
    "formulaOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResultParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultVersion" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "resultId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "changedByRole" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL DEFAULT gen_object_id(),
    "insertOrder" SERIAL NOT NULL,
    "resultId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL DEFAULT '',
    "uhid" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "invoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "enquiryNo" TEXT NOT NULL DEFAULT '',
    "reportNo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Final',
    "tests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "data" BYTEA NOT NULL,
    "savedById" TEXT,
    "savedByName" TEXT,
    "savedByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_insertOrder_key" ON "User"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_insertOrder_key" ON "RolePermission"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_key" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_insertOrder_key" ON "AuditLog"("insertOrder");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_insertOrder_key" ON "Department"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Department_departmentName_key" ON "Department"("departmentName");

-- CreateIndex
CREATE UNIQUE INDEX "Department_departmentCode_key" ON "Department"("departmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_insertOrder_key" ON "Doctor"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_insertOrder_key" ON "Organization"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_organizationName_key" ON "Organization"("organizationName");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_insertOrder_key" ON "LabTest"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_testCode_key" ON "LabTest"("testCode");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_reportTemplateAttachmentId_key" ON "LabTest"("reportTemplateAttachmentId");

-- CreateIndex
CREATE INDEX "LabTest_processingMode_idx" ON "LabTest"("processingMode");

-- CreateIndex
CREATE INDEX "LabTest_tpaId_idx" ON "LabTest"("tpaId");

-- CreateIndex
CREATE UNIQUE INDEX "TestParameter_insertOrder_key" ON "TestParameter"("insertOrder");

-- CreateIndex
CREATE INDEX "TestParameter_testId_displayOrder_idx" ON "TestParameter"("testId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttachment_insertOrder_key" ON "TestAttachment"("insertOrder");

-- CreateIndex
CREATE INDEX "TestAttachment_testId_idx" ON "TestAttachment"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "TestPackage_insertOrder_key" ON "TestPackage"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TestPackage_packageCode_key" ON "TestPackage"("packageCode");

-- CreateIndex
CREATE INDEX "TestPackage_departmentId_idx" ON "TestPackage"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RateHistory_insertOrder_key" ON "RateHistory"("insertOrder");

-- CreateIndex
CREATE INDEX "RateHistory_testId_idx" ON "RateHistory"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundPolicy_insertOrder_key" ON "RefundPolicy"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RefundPolicy_singleton_key" ON "RefundPolicy"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_insertOrder_key" ON "Patient"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_uhid_key" ON "Patient"("uhid");

-- CreateIndex
CREATE INDEX "Patient_patientName_idx" ON "Patient"("patientName");

-- CreateIndex
CREATE INDEX "Patient_mobile_idx" ON "Patient"("mobile");

-- CreateIndex
CREATE INDEX "Patient_referringDoctorId_idx" ON "Patient"("referringDoctorId");

-- CreateIndex
CREATE INDEX "Patient_organizationId_idx" ON "Patient"("organizationId");

-- CreateIndex
CREATE INDEX "Patient_registrationDate_idx" ON "Patient"("registrationDate");

-- CreateIndex
CREATE INDEX "Patient_status_registrationDate_idx" ON "Patient"("status", "registrationDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_insertOrder_key" ON "Appointment"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentId_key" ON "Appointment"("appointmentId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_collectionType_idx" ON "Appointment"("collectionType");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_insertOrder_key" ON "Invoice"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_enquiryNo_key" ON "Invoice"("enquiryNo");

-- CreateIndex
CREATE INDEX "Invoice_patientId_idx" ON "Invoice"("patientId");

-- CreateIndex
CREATE INDEX "Invoice_uhid_idx" ON "Invoice"("uhid");

-- CreateIndex
CREATE INDEX "Invoice_referringDoctorId_createdAt_idx" ON "Invoice"("referringDoctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_discountDoctorId_idx" ON "Invoice"("discountDoctorId");

-- CreateIndex
CREATE INDEX "Invoice_priority_idx" ON "Invoice"("priority");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_createdAt_idx" ON "Invoice"("paymentStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_paymentMethod_idx" ON "Invoice"("paymentMethod");

-- CreateIndex
CREATE INDEX "Invoice_barcode_idx" ON "Invoice"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_insertOrder_key" ON "InvoiceItem"("insertOrder");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "InvoiceItem_testId_idx" ON "InvoiceItem"("testId");

-- CreateIndex
CREATE INDEX "InvoiceItem_departmentId_idx" ON "InvoiceItem"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePaymentSplit_insertOrder_key" ON "InvoicePaymentSplit"("insertOrder");

-- CreateIndex
CREATE INDEX "InvoicePaymentSplit_invoiceId_position_idx" ON "InvoicePaymentSplit"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "InvoicePaymentSplit_method_idx" ON "InvoicePaymentSplit"("method");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRevision_insertOrder_key" ON "InvoiceRevision"("insertOrder");

-- CreateIndex
CREATE INDEX "InvoiceRevision_invoiceId_at_idx" ON "InvoiceRevision"("invoiceId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_insertOrder_key" ON "Payment"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_insertOrder_key" ON "PaymentTransaction"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_txnId_key" ON "PaymentTransaction"("txnId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_paymentId_key" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_invoiceId_idx" ON "PaymentTransaction"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_insertOrder_key" ON "Refund"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundId_key" ON "Refund"("refundId");

-- CreateIndex
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");

-- CreateIndex
CREATE INDEX "Refund_patientId_idx" ON "Refund"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_insertOrder_key" ON "Expense"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseId_key" ON "Expense"("expenseId");

-- CreateIndex
CREATE INDEX "Expense_payeeType_idx" ON "Expense"("payeeType");

-- CreateIndex
CREATE INDEX "Expense_payeeName_idx" ON "Expense"("payeeName");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_doctorId_idx" ON "Expense"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_insertOrder_key" ON "Sample"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleId_key" ON "Sample"("sampleId");

-- CreateIndex
CREATE INDEX "Sample_barcode_idx" ON "Sample"("barcode");

-- CreateIndex
CREATE INDEX "Sample_patientId_idx" ON "Sample"("patientId");

-- CreateIndex
CREATE INDEX "Sample_uhid_idx" ON "Sample"("uhid");

-- CreateIndex
CREATE INDEX "Sample_enquiryNo_idx" ON "Sample"("enquiryNo");

-- CreateIndex
CREATE INDEX "Sample_invoiceId_idx" ON "Sample"("invoiceId");

-- CreateIndex
CREATE INDEX "Sample_processingMode_idx" ON "Sample"("processingMode");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "Sample_priority_idx" ON "Sample"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "SampleStatusHistory_insertOrder_key" ON "SampleStatusHistory"("insertOrder");

-- CreateIndex
CREATE INDEX "SampleStatusHistory_sampleId_timestamp_idx" ON "SampleStatusHistory"("sampleId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Result_insertOrder_key" ON "Result"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Result_resultId_key" ON "Result"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_sampleId_key" ON "Result"("sampleId");

-- CreateIndex
CREATE INDEX "Result_patientId_idx" ON "Result"("patientId");

-- CreateIndex
CREATE INDEX "Result_uhid_idx" ON "Result"("uhid");

-- CreateIndex
CREATE INDEX "Result_enquiryNo_idx" ON "Result"("enquiryNo");

-- CreateIndex
CREATE INDEX "Result_invoiceId_idx" ON "Result"("invoiceId");

-- CreateIndex
CREATE INDEX "Result_testId_idx" ON "Result"("testId");

-- CreateIndex
CREATE INDEX "Result_departmentId_idx" ON "Result"("departmentId");

-- CreateIndex
CREATE INDEX "Result_status_idx" ON "Result"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ResultParameter_insertOrder_key" ON "ResultParameter"("insertOrder");

-- CreateIndex
CREATE INDEX "ResultParameter_resultId_displayOrder_idx" ON "ResultParameter"("resultId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ResultVersion_insertOrder_key" ON "ResultVersion"("insertOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ResultVersion_resultId_version_key" ON "ResultVersion"("resultId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SavedReport_insertOrder_key" ON "SavedReport"("insertOrder");

-- CreateIndex
CREATE INDEX "SavedReport_resultId_idx" ON "SavedReport"("resultId");

-- CreateIndex
CREATE INDEX "SavedReport_patientId_idx" ON "SavedReport"("patientId");

-- CreateIndex
CREATE INDEX "SavedReport_uhid_idx" ON "SavedReport"("uhid");

-- CreateIndex
CREATE INDEX "SavedReport_invoiceId_idx" ON "SavedReport"("invoiceId");

-- CreateIndex
CREATE INDEX "SavedReport_status_idx" ON "SavedReport"("status");

-- CreateIndex
CREATE INDEX "SavedReport_createdAt_idx" ON "SavedReport"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_tpaId_fkey" FOREIGN KEY ("tpaId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_reportTemplateAttachmentId_fkey" FOREIGN KEY ("reportTemplateAttachmentId") REFERENCES "TestAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttachment" ADD CONSTRAINT "TestAttachment_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttachment" ADD CONSTRAINT "TestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackage" ADD CONSTRAINT "TestPackage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackageItem" ADD CONSTRAINT "TestPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TestPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPackageItem" ADD CONSTRAINT "TestPackageItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateHistory" ADD CONSTRAINT "RateHistory_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateHistory" ADD CONSTRAINT "RateHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_referringDoctorId_fkey" FOREIGN KEY ("referringDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTest" ADD CONSTRAINT "AppointmentTest_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTest" ADD CONSTRAINT "AppointmentTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_referringDoctorId_fkey" FOREIGN KEY ("referringDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_discountDoctorId_fkey" FOREIGN KEY ("discountDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TestPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePaymentSplit" ADD CONSTRAINT "InvoicePaymentSplit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleStatusHistory" ADD CONSTRAINT "SampleStatusHistory_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleStatusHistory" ADD CONSTRAINT "SampleStatusHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultParameter" ADD CONSTRAINT "ResultParameter_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultVersion" ADD CONSTRAINT "ResultVersion_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allowed values for the columns Mongoose declared with `enum`. Kept as
-- text (not Postgres enums) so the stored strings are exactly the ones the
-- app already reads and writes.
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('Admin', 'Pathologist', 'Lab Technician', 'Receptionist', 'Accountant', 'Phlebotomist'));
ALTER TABLE "User" ADD CONSTRAINT "User_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "Department" ADD CONSTRAINT "Department_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_gender_check" CHECK ("gender" IN ('Male', 'Female', 'Other'));
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_paymentTerm_check" CHECK ("paymentTerm" IN ('Daily', 'Weekly', 'Monthly', 'Immediate'));
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_discountType_check" CHECK ("discountType" IN ('Percentage', 'Fixed', 'No Discount Only Cut'));
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_contractRate_check" CHECK ("contractRate" IN ('Corporate', 'Standard', 'Discounted'));
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_paymentTerms_check" CHECK ("paymentTerms" IN ('Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'));
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_testType_check" CHECK ("testType" IN ('Routine', 'Special', 'Urgent', 'Profile'));
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_processingMode_check" CHECK ("processingMode" IN ('In-house', 'Outsource'));
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_resultType_check" CHECK ("resultType" IN ('Numeric', 'Text', 'Dropdown', 'Positive/Negative', 'Reactive/Non-Reactive', 'Normal/Abnormal', 'Header'));
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_paraFor_check" CHECK ("paraFor" IN ('ALL', 'MALE', 'FEMALE'));
ALTER TABLE "TestAttachment" ADD CONSTRAINT "TestAttachment_kind_check" CHECK ("kind" IN ('reference', 'report-template'));
ALTER TABLE "TestPackage" ADD CONSTRAINT "TestPackage_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_gender_check" CHECK ("gender" IN ('Male', 'Female', 'Male Child', 'Female Child', 'Other', 'Child'));
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_status_check" CHECK ("status" IN ('Active', 'Inactive'));
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_collectionType_check" CHECK ("collectionType" IN ('Lab Visit', 'Home Collection'));
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_status_check" CHECK ("status" IN ('Pending', 'Confirmed', 'Assigned', 'On The Way', 'Collected', 'Submitted', 'Completed', 'Cancelled'));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_priority_check" CHECK ("priority" IN ('Routine', 'Urgent'));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_discountType_check" CHECK ("discountType" IN ('Percentage', 'Fixed'));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentStatus_check" CHECK ("paymentStatus" IN ('Paid', 'Partial', 'Unpaid', 'Credit'));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentMethod_check" CHECK ("paymentMethod" IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online', 'Credit'));
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_processingMode_check" CHECK ("processingMode" IN ('In-house', 'Outsource'));
ALTER TABLE "InvoicePaymentSplit" ADD CONSTRAINT "InvoicePaymentSplit_method_check" CHECK ("method" IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online', 'Credit'));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethod_check" CHECK ("paymentMethod" IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online', 'Credit'));
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_method_check" CHECK ("method" IN ('UPI', 'Card'));
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_status_check" CHECK ("status" IN ('Pending', 'Success', 'Failed', 'Expired', 'Cancelled'));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentMethod_check" CHECK ("paymentMethod" IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online', 'Credit'));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payeeType_check" CHECK ("payeeType" IN ('Ambulance', 'Doctor Referral', 'Collection Agent', 'Courier', 'Staff Advance', 'Vendor / Supplier', 'Reagents & Consumables', 'Equipment & Maintenance', 'Rent & Utilities', 'Other'));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethod_check" CHECK ("paymentMethod" IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online', 'Credit'));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_status_check" CHECK ("status" IN ('Pending', 'Paid', 'Rejected'));
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_processingMode_check" CHECK ("processingMode" IN ('In-house', 'Outsource'));
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_status_check" CHECK ("status" IN ('Registered', 'Pending Collection', 'Collected', 'Received', 'Processing', 'Completed', 'Rejected', 'Recollected', 'Cancelled'));
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_priority_check" CHECK ("priority" IN ('Routine', 'Urgent'));
ALTER TABLE "Result" ADD CONSTRAINT "Result_status_check" CHECK ("status" IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Final'));
ALTER TABLE "ResultParameter" ADD CONSTRAINT "ResultParameter_flag_check" CHECK ("flag" IN ('Normal', 'Low', 'High', 'Critical'));
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_status_check" CHECK ("status" IN ('Provisional', 'Final'));
