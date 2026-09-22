import { Schema, model } from 'mongoose';
import { IOrganizationDocument } from '../types/organization.interface';
import { ALL_STATUSES } from '../constants/roles';

const organizationSchema = new Schema<IOrganizationDocument>(
  {
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      unique: true,
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, default: '' },
    contractRate: {
      type: String,
      enum: ['Corporate', 'Standard', 'Discounted'],
      default: 'Corporate',
    },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    creditLimit: { type: Number, default: 0, min: 0 },
    paymentTerms: {
      type: String,
      enum: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'],
      default: 'Net 30',
    },
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

export const Organization = model<IOrganizationDocument>('Organization', organizationSchema);
