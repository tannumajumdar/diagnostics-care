import { Document, Schema } from 'mongoose';

export interface IPatientDocument extends Document {
  uhid: string;
  patientName: string;
  gender: 'Male' | 'Female' | 'Male Child' | 'Female Child' | 'Other' | 'Child';
  dateOfBirth?: Date;
  age: number;
  mobile: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  emergencyContact?: string;
  referringDoctor?: Schema.Types.ObjectId;
  organization?: Schema.Types.ObjectId;
  registrationDate: Date;
  status: string;
}

