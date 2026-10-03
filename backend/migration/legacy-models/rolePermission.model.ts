import { Schema, model, Document } from 'mongoose';

/**
 * What one role may do, as the Admin set it on the Roles & Permissions screen.
 * A role with no row here runs on the shipped defaults.
 */
export interface IRolePermissionDocument extends Document {
  role: string;
  permissions: string[];
  updatedBy?: { userId?: string; name?: string; at?: Date };
}

const rolePermissionSchema = new Schema<any>(
  {
    role: { type: String, required: true, unique: true, index: true },
    permissions: { type: [String], default: [] },
    updatedBy: {
      userId: { type: String },
      name: { type: String },
      at: { type: Date },
    },
  },
  { timestamps: true }
);

export const RolePermission = model<any>('RolePermission', rolePermissionSchema);
