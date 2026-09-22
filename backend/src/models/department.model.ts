import { Schema, model } from 'mongoose';
import { IDepartmentDocument } from '../types/department.interface';
import { ALL_STATUSES } from '../constants/roles';

const departmentSchema = new Schema<IDepartmentDocument>(
  {
    departmentName: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      unique: true,
    },
    departmentCode: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
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

export const Department = model<IDepartmentDocument>('Department', departmentSchema);
