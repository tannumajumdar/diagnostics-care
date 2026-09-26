export type UserRole =
  | 'Admin'
  | 'Receptionist'
  | 'Lab Technician'
  | 'Pathologist'
  | 'Accountant'
  | 'Phlebotomist';

export type UserStatus = 'Active' | 'Inactive';
export type PaymentTerm = 'Daily' | 'Weekly' | 'Monthly' | 'Immediate';
export type DiscountType = 'Percentage' | 'Fixed';
export type ResultType =
  | 'Numeric'
  | 'Text'
  | 'Dropdown'
  | 'Positive/Negative'
  | 'Reactive/Non-Reactive'
  | 'Normal/Abnormal'
  // A section title inside a panel (RBC INDICES) - no value, unit or range.
  | 'Header';
export type TestType = 'Routine' | 'Special' | 'Urgent' | 'Profile';

/** Run at the centre's own bench, or couriered out to another lab. */
export type ProcessingMode = 'In-house' | 'Outsource';
export type ContractRate = 'Corporate' | 'Standard' | 'Discounted';
export type OrgPaymentTerm = 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Immediate';
// A child is read against the paediatric band, but a paediatric report still
// needs the sex - so the desk registers which child. 'Child' is kept only so
// records registered before the split still type-check; it is off the dropdown.
export type Gender = 'Male' | 'Female' | 'Male Child' | 'Female Child' | 'Other' | 'Child';

export type BillingPaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Credit';
/** Mirrors COLLECTION_METHODS in config/payment-methods.ts. */
export type BillingPaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Card'
  | 'Bank Transfer'
  | 'Cheque'
  | 'Online'
  | 'Credit';

export type SampleStatus =
  | 'Registered'
  | 'Pending Collection'
  | 'Collected'
  | 'Received'
  | 'Processing'
  | 'Completed'
  | 'Rejected'
  | 'Recollected'
  /** Called off by the patient, as against rejected by the lab. */
  | 'Cancelled';

export type SampleRejectionReason =
  | 'Insufficient Sample'
  | 'Hemolyzed'
  | 'Clotted'
  | 'Wrong Container'
  | 'Wrong Sample'
  | 'Leakage'
  | 'Delayed Sample'
  | 'Other';

export type ResultStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Final';
export type ResultFlag = 'Normal' | 'Low' | 'High' | 'Critical';

export type CollectionType = 'Lab Visit' | 'Home Collection';
export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Assigned'
  | 'On The Way'
  | 'Collected'
  | 'Submitted'
  | 'Completed'
  | 'Cancelled';

export interface AppointmentRecord {
  _id: string;
  appointmentId: string;
  patient?: Patient | any;
  patientName: string;
  mobile: string;
  doctor?: Doctor | any;
  tests: (LabTest | any)[];
  date: string;
  time: string;
  collectionType: CollectionType;
  address?: string;
  phlebotomist?: {
    userId: string;
    name: string;
    mobile?: string;
  };
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecord {
  _id: string;
  refundId: string;
  invoice: Invoice | any;
  patient: Patient | any;
  originalAmount: number;
  refundAmount: number;
  reason: string;
  paymentMethod: BillingPaymentMethod;
  approvedBy: {
    userId: string;
    name: string;
    role: string;
  };
  date: string;
  remarks?: string;
  createdAt: string;
}

export const PAYEE_TYPES = [
  'Ambulance',
  'Doctor Referral',
  'Collection Agent',
  'Courier',
  'Staff Advance',
  'Vendor / Supplier',
  'Reagents & Consumables',
  'Equipment & Maintenance',
  'Rent & Utilities',
  'Other',
] as const;

export type PayeeType = (typeof PAYEE_TYPES)[number];
export type PayoutStatus = 'Pending' | 'Paid' | 'Rejected';

/** One outgoing payment: the ambulance, a courier, a supplier, a doctor cut. */
export interface PayoutRecord {
  _id: string;
  expenseId: string;
  payeeType: PayeeType;
  payeeName: string;
  payeeContact?: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: BillingPaymentMethod;
  referenceNo?: string;
  expenseDate: string;
  status: PayoutStatus;
  needsApproval: boolean;
  patient?: Patient | any;
  invoice?: Invoice | any;
  doctor?: Doctor | any;
  recordedBy: {
    userId: string;
    name: string;
    role?: string;
  };
  approvedBy?: {
    userId: string;
    name: string;
    role?: string;
    at?: string;
  };
  rejectionReason?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface VisitClinicalInfo {
  /** What the patient came in for, taken at the front desk. */
  chiefComplaint?: string;
  clinicalNotes?: string;
  priority?: 'Routine' | 'Urgent';
}

export interface PayoutSummary {
  period: { from: string; to: string };
  totalPaid: number;
  paidCount: number;
  totalPending: number;
  pendingCount: number;
  byType: { payeeType: PayeeType; total: number; count: number }[];
  byPayee: { payeeName: string; payeeType: PayeeType; total: number; count: number; lastPaidAt: string }[];
  byDay: { date: string; total: number; count: number }[];
  pendingApprovals: PayoutRecord[];
}

export interface DailyCollectionSummary {
  date: string;
  breakdown: {
    cash: number;
    upi: number;
    card: number;
    bank: number;
    cheque: number;
    online: number;
    /** Billed to be collected later, not money in the drawer today. */
    credit: number;
    total: number;
  };
  /** Cash handed out on the same day, so the drawer can be reconciled. */
  totalPaidOut: number;
  netInHand: number;
  payments: PaymentRecord[];
}

export interface DoctorCommissionReport {
  doctorId: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  totalReferredTests: number;
  totalRevenue: number;
  commissionPercentage: number;
  commissionEarned: number;
  commissionPaid: number;
  commissionPending: number;
}

export interface ParameterResult {
  parameterId?: string;
  parameterName: string;
  shortName?: string;
  value: string;
  unit?: string;
  referenceRange: string;
  flag: ResultFlag;
  /** The bench set the flag by hand - the server keeps it instead of recalculating. */
  flagManual?: boolean;
  method?: string;
  remarks?: string;
  resultType: string;
  dropdownOptions?: string[];
  criticalLow?: string;
  criticalHigh?: string;
  highRange?: string;
  lowRange?: string;
}

export interface ResultVersion {
  version: number;
  changedBy: {
    userId: string;
    name: string;
    role: string;
  };
  results: ParameterResult[];
  status: ResultStatus;
  reason?: string;
  timestamp: string;
}

export interface SampleStatusHistory {
  fromStatus?: SampleStatus;
  toStatus: SampleStatus;
  updatedBy: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: string;
  notes?: string;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  /** Granted actions, sent by the API on login and on /auth/me. */
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  error?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Department {
  id: string;
  departmentName: string;
  departmentCode: string;
  description?: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  doctorName: string;
  department: {
    id: string;
    departmentName: string;
    departmentCode: string;
  } | string;
  degree?: string;
  specialty?: string;
  mobile: string;
  email?: string;
  dob?: string;
  area?: string;
  areaCode?: string;
  hospital?: string;
  paymentTerm: PaymentTerm;
  discountType: DiscountType;
  discountPercentage: number;
  commission: number;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TestParameter {
  _id?: string;
  parameterName: string;
  shortName?: string;
  unit?: string;
  maleReferenceRange?: string;
  femaleReferenceRange?: string;
  childReferenceRange?: string;
  criticalLow?: string;
  criticalHigh?: string;
  method?: string;
  resultType: ResultType;
  dropdownOptions?: string[];
  decimalPrecision?: number;
  displayOrder: number;
  // One row per sex / age band, as on the lab's desktop parameter screen. The
  // same parameter repeats for each band; the sheet picks the one that fits.
  paraFor?: ParaFor;
  minValue?: string;
  maxValue?: string;
  /** At or above this the value flags High. */
  highRange?: string;
  /** At or below this the value flags Low. */
  lowRange?: string;
  ageFromDays?: number;
  /** 0 means no upper limit. */
  ageToDays?: number;
  /** Normal value for a line that is not a number - "Negative", "Clear". */
  referenceText?: string;
}

export type ParaFor = 'ALL' | 'MALE' | 'FEMALE';

export interface LabTest {
  id: string;
  testName: string;
  testCode: string;
  department: {
    id: string;
    departmentName: string;
    departmentCode: string;
  } | string;
  testType: TestType;
  sampleType: string;
  sampleContainer: string;
  rate: number;
  patientRate: number;
  corporateRate: number;
  doctorRate: number;
  emergencyRate: number;
  /** What a referring doctor's own bill prints this test at - normally higher. */
  referralRate?: number;
  /** Run at the bench, or sent out to another lab. */
  processingMode?: ProcessingMode;
  outsourceLab?: string;
  outsourceCost?: number;
  /** The corporate / insurance TPA this test belongs to - null is the centre's own catalogue. */
  tpa?: { id: string; organizationName: string } | string | null;
  discountAllowed: boolean;
  fastingRequired: boolean;
  preparationRequired?: string;
  /** What the result means - kept with the test in the catalogue. */
  interpretation?: string;
  turnaroundTime: string;
  description?: string;
  instructions?: string;
  status: UserStatus;
  parameters: TestParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface RateSet {
  rate: number;
  patientRate: number;
  corporateRate: number;
  doctorRate: number;
  emergencyRate: number;
  referralRate?: number;
}

/**
 * A panel the centre sells as one thing. The tests inside stay ordinary
 * catalogue tests - the package only decides what the whole set costs.
 */
export interface TestPackage {
  id: string;
  _id?: string;
  packageName: string;
  packageCode: string;
  description?: string;
  /**
   * What the centre files the panel under. Null for a panel that spans the
   * lab - a full body checkup belongs to no single bench.
   */
  department?: { id: string; departmentName: string; departmentCode?: string } | string | null;
  /** The departments of the tests inside, when the panel itself has none. */
  testDepartments?: string[];
  tests: LabTest[];
  /** What the patient pays for the whole panel. */
  rate: number;
  /** What the referring doctor's copy prints the panel at. 0 = no separate price. */
  referralRate?: number;
  discountAllowed?: boolean;
  status: UserStatus;
  testCount?: number;
  /** What the tests inside would have cost billed one by one. */
  listTotal?: number;
  referralListTotal?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RateHistory {
  _id: string;
  testId: string;
  testCode: string;
  testName: string;
  previousRates: RateSet;
  newRates: RateSet;
  changedBy: {
    userId: string;
    name: string;
    email: string;
  };
  reason?: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  organizationName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  contractRate: ContractRate;
  discount: number;
  creditLimit: number;
  paymentTerms: OrgPaymentTerm;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  uhid: string;
  patientName: string;
  gender: Gender;
  dateOfBirth?: string;
  age: number;
  mobile: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  emergencyContact?: string;
  referringDoctor?: {
    id: string;
    doctorName: string;
    mobile?: string;
    hospital?: string;
  } | string;
  organization?: {
    id: string;
    organizationName: string;
    contractRate?: string;
  } | string;
  registrationDate: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  _id?: string;
  test: string;
  department: string;
  departmentName?: string;
  testName: string;
  testCode: string;
  rate: number;
  discountPercent?: number;
  /** What the desk knocked off this line before any bill-wide discount. */
  lineDiscountAmount?: number;
  discountAmount: number;
  netAmount: number;
  processingMode?: ProcessingMode;
  outsourceLab?: string;
  /** Printed on the referring doctor's copy only. */
  referralRate?: number;
  packageId?: string;
  packageName?: string;
  /**
   * The patient decided against this test. The line stays on the bill struck
   * through - a bill that silently loses a line cannot be reconciled against
   * the receipt the patient is holding.
   */
  cancelled?: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  /** What went back to the patient for this line. */
  refundedAmount?: number;
  /** What the centre kept of it, per the refund policy. */
  retainedAmount?: number;
  cancelledBy?: { userId: string; name: string; role: string };
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  uhid?: string;
  patient: Patient | any;
  referringDoctor?: Doctor | any;
  organization?: Organization | any;
  /** Typed at the desk when the doctor is not on the panel. */
  referringDoctorName?: string;
  chiefComplaint?: string;
  clinicalNotes?: string;
  priority?: 'Routine' | 'Urgent';
  items: InvoiceItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountReason?: string;
  /**
   * The doctor the concession came through - not necessarily the one who
   * referred the patient.
   */
  discountDoctor?: { id?: string; _id?: string; doctorName: string } | string | null;
  discountDoctorName?: string;
  /** Every change made to the bill after it was raised. */
  revisions?: Array<{
    at: string;
    by?: { userId?: string; name?: string; role?: string };
    summary: string;
    testsAdded: string[];
    netBefore: number;
    netAfter: number;
  }>;
  totalDiscount?: number;
  netAmount: number;
  /** What the referring doctor's separate copy of this bill comes to. */
  referralTotal?: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: BillingPaymentStatus;
  paymentMethod: BillingPaymentMethod;
  barcode: string;
  createdBy: {
    userId: string;
    name: string;
    role?: string;
  };
  status?: 'Active' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  _id: string;
  receiptNumber: string;
  invoice: string;
  patient: string;
  amount: number;
  paymentMethod: BillingPaymentMethod;
  transactionRef?: string;
  notes?: string;
  receivedBy: {
    userId: string;
    name: string;
  };
  date?: string;
  createdAt: string;
}

export interface SampleRecord {
  _id: string;
  sampleId: string;
  barcode: string;
  patient: Patient | any;
  uhid: string;
  invoice: Invoice | any;
  test: LabTest | any;
  testCode: string;
  testName: string;
  department: Department | any;
  sampleType: string;
  sampleContainer: string;
  /** Taken off the bill line, so a single bill can be sent out on its own. */
  processingMode?: ProcessingMode;
  outsourceLab?: string;
  collectionDate?: string;
  collectionTime?: string;
  collector?: string;
  status: SampleStatus;
  rejectionReason?: SampleRejectionReason | string;
  rejectionRemarks?: string;
  rejectedBy?: {
    userId: string;
    name: string;
  };
  rejectedAt?: string;
  statusHistory: SampleStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface SampleDashboardStats {
  pendingCollection: number;
  collected: number;
  processing: number;
  completed: number;
  rejected: number;
  total: number;
}

export interface ResultRecord {
  _id: string;
  resultId: string;
  patient: Patient | any;
  uhid: string;
  invoice: Invoice | any;
  sample: SampleRecord | any;
  test: LabTest | any;
  department: Department | any;
  results: ParameterResult[];
  status: ResultStatus;
  overallRemarks?: string;
  enteredBy: {
    userId: string;
    name: string;
    role: string;
    date: string;
  };
  verifiedBy?: {
    userId: string;
    name: string;
    role: string;
    date: string;
  };
  rejectionReason?: string;
  versions: ResultVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceParams {
  patientId: string;
  referringDoctorId?: string;
  organizationId?: string;
  items: {
    testId: string;
    discountPercent?: number;
  }[];
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;
  paidAmount: number;
  paymentMethod: BillingPaymentMethod;
}

export interface AddPaymentParams {
  amount: number;
  paymentMethod: BillingPaymentMethod;
  transactionRef?: string;
  notes?: string;
}

export interface PatientHistoryDetails {
  patient: Patient;
  testHistory: any[];
  invoices: any[];
  reports: any[];
  payments: any[];
  appointments: any[];
}
