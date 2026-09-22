import { Schema, model } from 'mongoose';
import { IAppointmentDocument } from '../types/appointment.interface';

const appointmentSchema = new Schema<IAppointmentDocument>(
  {
    appointmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    tests: [
      {
        type: Schema.Types.ObjectId,
        ref: 'LabTest',
      },
    ],
    date: {
      type: Date,
      required: true,
      index: true,
    },
    time: {
      type: String,
      required: true,
    },
    collectionType: {
      type: String,
      enum: ['Lab Visit', 'Home Collection'],
      default: 'Lab Visit',
      index: true,
    },
    address: {
      type: String,
      default: '',
    },
    phlebotomist: {
      userId: { type: String },
      name: { type: String },
      mobile: { type: String },
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'Confirmed',
        'Assigned',
        'On The Way',
        'Collected',
        'Submitted',
        'Completed',
        'Cancelled',
      ],
      default: 'Pending',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Appointment = model<IAppointmentDocument>('Appointment', appointmentSchema);
