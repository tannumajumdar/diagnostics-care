import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';

export const validateRequest =
  // ZodTypeAny rather than AnyZodObject: a schema carrying a .refine() (such
  // as "either an existing patient or new patient details") is a ZodEffects,
  // which the runtime check below already handles.
  (schema: ZodTypeAny) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const shape = (schema as any).shape;
      if (shape && (shape.body || shape.query || shape.params)) {
        await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
      } else {
        await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));
        next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
