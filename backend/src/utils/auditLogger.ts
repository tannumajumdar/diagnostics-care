import { repo } from '../db/repo';

export interface AuditParams {
  action: string;
  module: string;
  user: { id?: string; _id?: string; name?: string; role?: string };
  ipAddress?: string;
  targetId?: string;
  details?: Record<string, any>;
}

export const logAuditAction = async (params: AuditParams) => {
  try {
    const performedBy = params.user.id || params.user._id || 'SYSTEM';
    await repo.create('auditLog', {
      action: params.action,
      module: params.module,
      performedBy,
      performedByName: params.user.name || 'Unknown User',
      userRole: params.user.role || 'Staff',
      ipAddress: params.ipAddress || '127.0.0.1',
      targetId: params.targetId,
      details: params.details,
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

