import { Schema, model } from 'mongoose';
import { ILabTestDocument } from '../types/test.interface';
import { ALL_STATUSES } from '../constants/roles';

const testParameterSchema = new Schema(
  {
    parameterName: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: '' },
    maleReferenceRange: { type: String, trim: true, default: '' },
    femaleReferenceRange: { type: String, trim: true, default: '' },
    childReferenceRange: { type: String, trim: true, default: '' },
    criticalLow: { type: String, trim: true, default: '' },
    criticalHigh: { type: String, trim: true, default: '' },
    method: { type: String, trim: true, default: '' },
    resultType: {
      type: String,
      // 'Header' is a section title inside a panel (RBC INDICES in a CBC) - it
      // carries no value, unit or range and only prints as a heading.
      enum: ['Numeric', 'Text', 'Dropdown', 'Positive/Negative', 'Reactive/Non-Reactive', 'Normal/Abnormal', 'Header'],
      default: 'Numeric',
    },
    displayOrder: { type: Number, default: 1 },
    // One row per band, the way the lab's desktop screen keeps them: the same
    // parameter repeats for each sex and age window it has a range for, and
    // the sheet picks the row that fits the patient. Rows saved before this
    // carry the male/female/child strings above instead and still work.
    paraFor: { type: String, enum: ['ALL', 'MALE', 'FEMALE'], default: 'ALL' },
    minValue: { type: String, trim: true, default: '' },
    maxValue: { type: String, trim: true, default: '' },
    /** Above this the value is flagged High - filled from MAX when left blank. */
    highRange: { type: String, trim: true, default: '' },
    /** Below this the value is flagged Low - filled from MIN when left blank. */
    lowRange: { type: String, trim: true, default: '' },
    ageFromDays: { type: Number, default: 0, min: 0 },
    /** 0 means no upper limit. */
    ageToDays: { type: Number, default: 0, min: 0 },
    /** Normal value for a line that is not a number - "Negative", "Clear". */
    referenceText: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const testSchema = new Schema<ILabTestDocument>(
  {
    testName: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
    },
    testCode: {
      type: String,
      required: [true, 'Test code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    testType: {
      type: String,
      enum: ['Routine', 'Special', 'Urgent', 'Profile'],
      default: 'Routine',
    },
    // The master screen no longer asks for the vial - these are the values the
    // form used to pre-fill, so a test added without them behaves as before and
    // sample registration (which needs both) still has something to print.
    sampleType: {
      type: String,
      trim: true,
      default: 'Whole Blood',
    },
    sampleContainer: {
      type: String,
      trim: true,
      default: 'EDTA Vial',
    },
    rate: { type: Number, required: true, min: 0 },
    patientRate: { type: Number, required: true, min: 0 },
    corporateRate: { type: Number, required: true, min: 0 },
    doctorRate: { type: Number, required: true, min: 0 },
    emergencyRate: { type: Number, required: true, min: 0 },
    // What a referring doctor's own bill prints this test at - normally a
    // little above the centre's rate, the difference being what the doctor
    // keeps. It never touches the patient's bill; it is only what the
    // doctor's copy shows.
    referralRate: { type: Number, default: 0, min: 0 },
    // Run at the bench or sent out. A test marked Outsource still bills and
    // queues exactly the same way - the flag tells the desk and the lab where
    // the sample is actually going, and it can be overridden on the bill when
    // an in-house machine is down.
    processingMode: {
      type: String,
      enum: ['In-house', 'Outsource'],
      default: 'In-house',
      index: true,
    },
    /** The lab it goes to when outsourced. */
    outsourceLab: { type: String, trim: true, default: '' },
    /** What that lab charges the centre, for the margin on the accounts side. */
    outsourceCost: { type: Number, default: 0, min: 0 },
    // A test booked for one corporate / insurance TPA only - the same
    // investigation under that TPA's own name and code. Null is the centre's
    // own catalogue, which every patient can be billed for.
    tpa: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    discountAllowed: { type: Boolean, default: true },
    fastingRequired: { type: Boolean, default: false },
    preparationRequired: { type: String, trim: true, default: '' },
    turnaroundTime: { type: String, trim: true, default: '24 Hours' },
    // What the result means - reference notes the pathologist wants kept with
    // the test. Files that go with it are TestAttachment documents.
    // The interpretation's headline ("Negative for S. typhi infection.") -
    // printed on the report under an underlined rule, with `interpretation`
    // below it as the comments.
    interpretationTitle: { type: String, trim: true, default: '' },
    interpretation: { type: String, trim: true, default: '' },
    // A Word file the patient's report for this test is printed from, its
    // #PLACEHOLDERS# filled in. The bytes are a TestAttachment of kind
    // 'report-template'; this is what the report needs to know without them.
    reportTemplate: {
      type: new Schema(
        {
          attachment: { type: Schema.Types.ObjectId, ref: 'TestAttachment', required: true },
          fileName: { type: String, required: true },
          size: { type: Number, default: 0 },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: null,
    },
    parameters: [testParameterSchema],
    status: {
      type: String,
      enum: ALL_STATUSES,
      required: [true, 'Status is required'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

export const LabTest = model<ILabTestDocument>('LabTest', testSchema);
