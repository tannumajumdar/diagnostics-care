import { Document } from 'mongoose';

export interface IDepartmentDocument extends Document {
  departmentName: string;
  departmentCode: string;
  description?: string;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

