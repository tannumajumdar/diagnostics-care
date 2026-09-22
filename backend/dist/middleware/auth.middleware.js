"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.authorize = exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
const user_model_1 = require("../models/user.model");
/**
 * A signed token is not enough on its own. The role and the account's standing
 * are read back from the database on every request, because the token was
 * minted up to eight hours ago and the Admin may have changed either since:
 * a demoted account kept its old powers until the token expired, a deactivated
 * one kept working, and a password reset left the old session live. The token
 * now only establishes *who* is asking - the database decides what they are.
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.UNAUTHORIZED);
        }
        const token = authHeader.split(' ')[1];
        const decoded = (0, jwt_util_1.verifyAccessToken)(token);
        const account = await user_model_1.User.findById(decoded.userId)
            .select('name email role status sessionsValidFrom')
            .lean();
        if (!account) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.UNAUTHORIZED);
        }
        if (account.status !== 'Active') {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Your account has been deactivated');
        }
        // `iat` is in seconds; a token minted in the same second as the reset is
        // treated as older, which is the safe direction to round.
        if (account.sessionsValidFrom && decoded.iat) {
            if (decoded.iat * 1000 <= new Date(account.sessionsValidFrom).getTime()) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, 'Your account was updated by an administrator. Please sign in again.');
            }
        }
        req.user = {
            userId: String(account._id),
            email: account.email,
            name: account.name,
            role: account.role,
        };
        next();
    }
    catch (error) {
        if (error instanceof api_error_util_1.ApiError) {
            next(error);
        }
        else {
            next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.TOKEN_EXPIRED));
        }
    }
};
exports.authenticate = authenticate;
const authorize = (...allowedRoles) => {
    const flattenedRoles = allowedRoles.flat();
    return (req, _res, next) => {
        if (!req.user) {
            return next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.UNAUTHORIZED));
        }
        if (!flattenedRoles.includes(req.user.role)) {
            return next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, messages_1.MESSAGES.AUTH.FORBIDDEN));
        }
        next();
    };
};
exports.authorize = authorize;
/**
 * Route guard expressed in terms of what the staff member is doing rather than
 * a hand-maintained role list, so a role's reach only ever changes in
 * constants/permissions.ts. Any one of the listed permissions is enough.
 */
const requirePermission = (...permissions) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.UNAUTHORIZED));
        }
        const granted = permissions.some((permission) => (0, permissions_1.can)(req.user.role, permission));
        if (!granted) {
            return next(new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, `Your role (${req.user.role}) is not permitted to perform this action`));
        }
        next();
    };
};
exports.requirePermission = requirePermission;
