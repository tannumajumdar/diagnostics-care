import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  module: string;
  performedBy: mongoose.Types.ObjectId | string;
  performedByName?: string;
  userRole?: string;
  ipAddress?: string;
  targetId?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    performedBy: { type: Schema.Types.Mixed, required: true, index: true },
    performedByName: { type: String },
    userRole: { type: String },
    ipAddress: { type: String },
    targetId: { type: String, index: true },
    details: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

