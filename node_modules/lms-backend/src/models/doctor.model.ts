import { Schema, model } from 'mongoose';
import { IDoctorDocument } from '../types/doctor.interface';
import { ALL_STATUSES } from '../constants/roles';

const doctorSchema = new Schema<IDoctorDocument>(
  {
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male',
    },
    degree: { type: String, trim: true, default: '' },
    specialty: { type: String, trim: true, default: '' },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: { type: String, trim: true, lowercase: true, default: '' },
    dob: { type: Date },
    area: { type: String, trim: true, default: '' },
    areaCode: { type: String, trim: true, default: '' },
    hospital: { type: String, trim: true, default: '' },
    paymentTerm: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly', 'Immediate'],
      default: 'Monthly',
    },
    discountType: {
      type: String,
      // "No Discount Only Cut" pays the referral cut without discounting the bill.
      enum: ['Percentage', 'Fixed', 'No Discount Only Cut'],
      default: 'Percentage',
    },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    commission: { type: Number, default: 0, min: 0, max: 100 },
    // Surfaced as the ADD-BY column on the doctor list.
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

export const Doctor = model<IDoctorDocument>('Doctor', doctorSchema);
