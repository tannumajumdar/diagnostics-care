import { StoredDocument, Ref } from './document';

export interface IPatientDocument extends StoredDocument {
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
  referringDoctor?: Ref;
  organization?: Ref;
  registrationDate: Date;
  status: string;
}

