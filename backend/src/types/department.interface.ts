import { StoredDocument } from './document';

export interface IDepartmentDocument extends StoredDocument {
  departmentName: string;
  departmentCode: string;
  description?: string;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

