import { Request, Response, NextFunction } from 'express';
import { repo } from '../db/repo';

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (req.query.module) query.module = String(req.query.module);
    if (req.query.action) query.action = String(req.query.action);

    const [logs, total] = await Promise.all([
      // `_id` breaks ties the way Mongo's natural order did for rows written in the same millisecond.
      repo.find('auditLog', { where: query, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take: limit }),
      repo.count('auditLog', query),
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
  } catch (error) {
    next(error);
  }
};

