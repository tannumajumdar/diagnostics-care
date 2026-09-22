import { Document, Types } from 'mongoose';

export type CollectionType = 'Lab Visit' | 'Home Collection';
export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Assigned'
  | 'On The Way'
  | 'Collected'
  | 'Submitted'
  | 'Completed'
  | 'Cancelled';

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  patient?: Types.ObjectId;
  patientName: string;
  mobile: string;
  doctor?: Types.ObjectId;
  tests: Types.ObjectId[];
  date: Date;
  time: string;
  collectionType: CollectionType;
  address?: string;
  phlebotomist?: {
    userId: string;
    name: string;
    mobile?: string;
  };
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
