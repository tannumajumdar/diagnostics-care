import { Document, Schema } from 'mongoose';

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
}

export interface ILabTestDocument extends Document {
  testName: string;
  testCode: string;
  department: Schema.Types.ObjectId;
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
  discountAllowed?: boolean;
  fastingRequired?: boolean;
  preparationRequired?: string;
  turnaroundTime?: string;
  status: string;
  parameters: ITestParameter[];
}

