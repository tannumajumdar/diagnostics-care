import { StoredDocument, Ref } from './document';

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

export interface IAppointmentDocument extends StoredDocument {
  appointmentId: string;
  patient?: Ref;
  patientName: string;
  mobile: string;
  doctor?: Ref;
  tests: Ref[];
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
