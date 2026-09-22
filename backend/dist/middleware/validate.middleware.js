"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const zod_1 = require("zod");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const validateRequest = 
// ZodTypeAny rather than AnyZodObject: a schema carrying a .refine() (such
// as "either an existing patient or new patient details") is a ZodEffects,
// which the runtime check below already handles.
(schema) => async (req, _res, next) => {
    try {
        const shape = schema.shape;
        if (shape && (shape.body || shape.query || shape.params)) {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
        }
        else {
            await schema.parseAsync(req.body);
        }
        next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const formattedErrors = error.errors.map((err) => ({
                field: err.path.join('.').replace(/^(body|query|params)\./, ''),
                message: err.message,
            }));
            next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Validation failed', formattedErrors));
        }
        else {
            next(error);
        }
    }
};
exports.validateRequest = validateRequest;
