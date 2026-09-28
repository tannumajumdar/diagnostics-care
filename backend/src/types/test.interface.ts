import { StoredDocument, Ref } from './document';

export interface ITestParameter {
  parameterName: string;
  shortName?: string;
  unit?: string;
  maleReferenceRange?: string;
  femaleReferenceRange?: string;
  criticalLow?: string;
  criticalHigh?: string;
  method?: string;
  resultType?: string;
  displayOrder?: number;
  paraFor?: 'ALL' | 'MALE' | 'FEMALE';
  minValue?: string;
  maxValue?: string;
  highRange?: string;
  lowRange?: string;
  ageFromDays?: number;
  ageToDays?: number;
  referenceText?: string;
  /** Calculated from the test's other lines - see utils/formula.util. */
  formula?: string;
}

export interface ILabTestDocument extends StoredDocument {
  testName: string;
  testCode: string;
  department: Ref;
  testType: string;
  sampleType: string;
  sampleContainer: string;
  rate: number;
  patientRate?: number;
  corporateRate?: number;
  doctorRate?: number;
  emergencyRate?: number;
  /** What the referring doctor's own bill prints this test at. */
  referralRate?: number;
  processingMode?: 'In-house' | 'Outsource';
  outsourceLab?: string;
  outsourceCost?: number;
  /** The TPA this test belongs to - null for the centre's own catalogue. */
  tpa?: Ref | null;
  discountAllowed?: boolean;
  fastingRequired?: boolean;
  preparationRequired?: string;
  interpretationTitle?: string;
  interpretation?: string;
  reportTemplate?: {
    attachment: Ref;
    fileName: string;
    size?: number;
    uploadedAt?: Date;
    uploadedBy?: string;
  } | null;
  turnaroundTime?: string;
  status: string;
  parameters: ITestParameter[];
}

