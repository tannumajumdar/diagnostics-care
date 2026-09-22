import { Document, Schema } from 'mongoose';

export interface IDoctorDocument extends Document {
  doctorName: string;
  department: Schema.Types.ObjectId;
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
  addedBy?: Schema.Types.ObjectId;
  status: string;
}

