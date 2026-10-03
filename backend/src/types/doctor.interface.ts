import { StoredDocument, Ref } from './document';

export interface IDoctorDocument extends StoredDocument {
  doctorName: string;
  department: Ref;
  gender?: string;
  degree?: string;
  specialty?: string;
  mobile: string;
  email?: string;
  dob?: Date;
  area?: string;
  areaCode?: string;
  hospital?: string;
  paymentTerm?: string;
  discountType?: string;
  discountPercentage?: number;
  commission?: number;
  addedBy?: Ref;
  status: string;
}

