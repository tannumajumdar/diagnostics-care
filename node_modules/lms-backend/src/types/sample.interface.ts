import { Document, Schema } from 'mongoose';

export interface ISampleDocument extends Document {
  sampleId: string;
  barcode: string;
  invoice: Schema.Types.ObjectId;
  patient: Schema.Types.ObjectId;
  uhid: string;
  /** The visit's enquiry number, copied off the invoice. */
  enquiryNo?: string;
  test: Schema.Types.ObjectId;
  testCode: string;
  testName: string;
  department: Schema.Types.ObjectId;
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

