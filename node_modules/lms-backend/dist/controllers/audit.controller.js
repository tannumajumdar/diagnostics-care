"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const auditLog_model_1 = require("../models/auditLog.model");
const getAuditLogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const query = {};
        if (req.query.module)
            query.module = req.query.module;
        if (req.query.action)
            query.action = req.query.action;
        const [logs, total] = await Promise.all([
            auditLog_model_1.AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            auditLog_model_1.AuditLog.countDocuments(query),
        ]);
        res.status(200).json({
            success: true,
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAuditLogs = getAuditLogs;
