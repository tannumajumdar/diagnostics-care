"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGES = exports.HTTP_STATUS = void 0;
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    // The request was understood but the record's own state refuses it - a
    // master row something else already depends on, for instance.
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
};
exports.MESSAGES = {
    AUTH: {
        LOGIN_SUCCESS: 'Logged in successfully',
        INVALID_CREDENTIALS: 'Invalid email or password',
        TOKEN_INVALID: 'Invalid token',
        TOKEN_EXPIRED: 'Token has expired',
        UNAUTHORIZED: 'Unauthorized access',
        FORBIDDEN: 'Access forbidden',
        LOGOUT_SUCCESS: 'Logged out successfully',
    },
};
