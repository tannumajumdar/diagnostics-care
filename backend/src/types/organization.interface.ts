import { Document } from 'mongoose';

export interface IOrganizationDocument extends Document {
  organizationName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  contractRate: 'Corporate' | 'Standard' | 'Discounted';
  discount: number;
  creditLimit: number;
  paymentTerms: 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Immediate';
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

