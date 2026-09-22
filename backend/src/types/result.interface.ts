import { Document, Schema } from 'mongoose';

export interface IParameterResult {
  parameterName: string;
  shortName?: string;
  /** Blank until the bench types it in - the sheet is created empty. */
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'Normal' | 'Low' | 'High' | 'Critical';
  method?: string;
  remarks?: string;
  resultType?: string;
  dropdownOptions?: string[];
  criticalLow?: string;
  criticalHigh?: string;
  displayOrder?: number;
}

export interface IResultDocument extends Document {
  resultId: string;
  sample: Schema.Types.ObjectId;
  invoice: Schema.Types.ObjectId;
  patient: Schema.Types.ObjectId;
  uhid: string;
  /** The visit's enquiry number, copied off the invoice. */
  enquiryNo?: string;
  test: Schema.Types.ObjectId;
  department?: Schema.Types.ObjectId;
  results: IParameterResult[];
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Final';
  overallRemarks?: string;
  rejectionReason?: string;
  versions?: any[];
  enteredBy: {
    userId: Schema.Types.ObjectId;
    name: string;
  };
  verifiedBy?: {
    userId: Schema.Types.ObjectId;
    name: string;
    role?: string;
    date: Date;
  };
}

