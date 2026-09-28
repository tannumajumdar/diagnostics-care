import { StoredDocument, Ref } from './document';

export interface ISampleDocument extends StoredDocument {
  sampleId: string;
  barcode: string;
  invoice: Ref;
  patient: Ref;
  uhid: string;
  /** The visit's enquiry number, copied off the invoice. */
  enquiryNo?: string;
  test: Ref;
  testCode: string;
  testName: string;
  department: Ref;
  sampleType: string;
  sampleContainer: string;
  processingMode?: 'In-house' | 'Outsource';
  outsourceLab?: string;
  status: 'Registered' | 'Pending Collection' | 'Collected' | 'Received' | 'Processing' | 'Completed' | 'Rejected' | 'Recollected' | 'Cancelled';
  rejectionReason?: string;
  rejectionRemarks?: string;
  rejectedBy?: any;
  rejectedAt?: Date;
  /** Called off by the patient, as against rejected by the lab. */
  cancelledAt?: Date;
  cancellationReason?: string;
  receivedAt?: Date;
  processingAt?: Date;
  completedAt?: Date;
  expectedAt?: Date;
  recollectionCount?: number;
  statusHistory?: any[];
  remarks?: string;
  priority?: 'Routine' | 'Urgent';
  chiefComplaint?: string;
  collectionDate?: Date;
  collectionTime?: string;
  collector?: string;
}

