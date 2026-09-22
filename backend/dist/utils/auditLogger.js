"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditAction = void 0;
const auditLog_model_1 = require("../models/auditLog.model");
const logAuditAction = async (params) => {
    try {
        const performedBy = params.user.id || params.user._id || 'SYSTEM';
        await auditLog_model_1.AuditLog.create({
            action: params.action,
            module: params.module,
            performedBy,
            performedByName: params.user.name || 'Unknown User',
            userRole: params.user.role || 'Staff',
            ipAddress: params.ipAddress || '127.0.0.1',
            targetId: params.targetId,
            details: params.details,
        });
    }
    catch (error) {
        console.error('Audit Log Error:', error);
    }
};
exports.logAuditAction = logAuditAction;
