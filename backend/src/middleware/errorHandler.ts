import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Turns the shapes the database layer throws into a sentence a desk can act on.
 *
 * Left raw, a missing field arrives as "LabTest validation failed: Path
 * `patientRate` is required." with a 500 beside it, and the screen can only
 * say "Operation failed" - which tells whoever is standing at the counter
 * nothing about what to fix.
 */
const readable = (err: any): { statusCode: number; message: string } | null => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = field ? err.keyValue[field] : '';
    return {
      statusCode: 409,
      message: field ? `${value} is already used by another record (${field})` : 'That record already exists',
    };
  }

  if (err?.name === 'ValidationError' && err?.errors) {
    const fields = Object.values(err.errors)
      .map((e: any) => e?.message)
      .filter(Boolean);
    return { statusCode: 400, message: fields.join(' ') || 'Some required fields are missing' };
  }

  // A unique constraint hit by a query that did not go through db/repo (which
  // reshapes it as the 11000 above, value included).
  if (err?.code === 'P2002') {
    const target = err.meta?.target;
    const field = Array.isArray(target) ? target[0] : target;
    return {
      statusCode: 409,
      message: field ? `That value is already used by another record (${field})` : 'That record already exists',
    };
  }

  if (err?.name === 'CastError') {
    return { statusCode: 400, message: `"${err.value}" is not a valid ${err.path}` };
  }

  // Field errors collected by the request validator: name the fields rather
  // than sending a bare "Validation failed".
  if (Array.isArray(err?.errors) && err.errors.length && err.errors[0]?.field) {
    return {
      statusCode: err.statusCode || 400,
      message: err.errors.map((e: any) => `${e.field}: ${e.message}`).join(', '),
    };
  }

  return null;
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const friendly = readable(err);
  const statusCode = friendly?.statusCode || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  // In production an unexpected failure's own text (a database error, a file
  // path) stays in the server log; the client gets a plain message.
  const message =
    friendly?.message ||
    (isProduction && statusCode >= 500 ? 'Something went wrong. Please try again.' : err.message) ||
    'Internal Server Error';

  if (!isProduction) {
    console.error(`[Error ${statusCode}] ${req.method} ${req.originalUrl}:`, err);
  } else if (statusCode >= 500) {
    console.error(`[Error ${statusCode}] ${req.method} ${req.originalUrl}: ${err?.stack || err}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

