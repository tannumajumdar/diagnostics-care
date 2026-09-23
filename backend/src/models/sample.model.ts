import { Schema, model } from 'mongoose';
import { ISampleDocument } from '../types/sample.interface';

const sampleStatusHistorySchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus: { type: String, required: true },
    updatedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const sampleSchema = new Schema<ISampleDocument>(
  {
    sampleId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    barcode: {
      type: String,
      required: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    uhid: {
      type: String,
      required: true,
      index: true,
    },
    // Copied off the invoice so the bench and the report can show the visit's
    // enquiry number without loading the bill. Absent on anything raised
    // before enquiry numbers existed.
    enquiryNo: {
      type: String,
      index: true,
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    test: {
      type: Schema.Types.ObjectId,
      ref: 'LabTest',
      required: true,
    },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    sampleType: { type: String, required: true },
    sampleContainer: { type: String, required: true },
    // Taken off the bill line rather than off the test master, because the
    // desk can send a single bill's work out. The collection queue reads it
    // to tell the phlebotomist this vial is going to a courier, not to the
    // bench next door.
    processingMode: {
      type: String,
      enum: ['In-house', 'Outsource'],
      default: 'In-house',
      index: true,
    },
    outsourceLab: { type: String, trim: true, default: '' },
    collectionDate: { type: Date },
    collectionTime: { type: String, default: '' },
    collector: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'Registered',
        'Pending Collection',
        'Collected',
        'Received',
        'Processing',
        'Completed',
        'Rejected',
        'Recollected',
        'Cancelled',
      ],
      default: 'Pending Collection',
      index: true,
    },
    // Copied from the visit so the collection and processing queues can put an
    // urgent case first, and so the bench reads the result against why the
    // patient came in - without joining back to the invoice for either.
    priority: {
      type: String,
      enum: ['Routine', 'Urgent'],
      default: 'Routine',
      index: true,
    },
    chiefComplaint: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    rejectionRemarks: { type: String, default: '' },
    rejectedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
    },
    rejectedAt: { type: Date },
    // Called off by the patient. Separate from a rejection, which is the
    // lab's own finding about the specimen.
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: '' },
    // Stage clocks - each is stamped once, when the sample enters that stage.
    receivedAt: { type: Date },
    processingAt: { type: Date },
    completedAt: { type: Date },
    /** TAT target, derived from the test's turnaroundTime at order time. */
    expectedAt: { type: Date },
    /** Incremented each time a rejected draw is repeated. */
    recollectionCount: { type: Number, default: 0 },
    statusHistory: [sampleStatusHistorySchema],
  },
  {
    timestamps: true,
  }
);

export const Sample = model<ISampleDocument>('Sample', sampleSchema);
