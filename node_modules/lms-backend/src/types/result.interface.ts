import { StoredDocument, Ref } from './document';

export interface IParameterResult {
  parameterName: string;
  shortName?: string;
  /** Blank until the bench types it in - the sheet is created empty. */
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'Normal' | 'Low' | 'High' | 'Critical';
  /** The bench set the flag by hand - it is kept rather than recalculated. */
  flagManual?: boolean;
  method?: string;
  remarks?: string;
  resultType?: string;
  dropdownOptions?: string[];
  criticalLow?: string;
  criticalHigh?: string;
  highRange?: string;
  lowRange?: string;
  displayOrder?: number;
  formula?: string;
  /** The bench typed over the calculated value - it is kept as typed. */
  formulaOverride?: boolean;
}

export interface IResultDocument extends StoredDocument {
  resultId: string;
  sample: Ref;
  invoice: Ref;
  patient: Ref;
  uhid: string;
  /** The visit's enquiry number, copied off the invoice. */
  enquiryNo?: string;
  test: Ref;
  department?: Ref;
  results: IParameterResult[];
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Final';
  overallRemarks?: string;
  rejectionReason?: string;
  versions?: any[];
  enteredBy: {
    userId: Ref;
    name: string;
  };
  verifiedBy?: {
    userId: Ref;
    name: string;
    role?: string;
    date: Date;
  };
}

