import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS, MESSAGES } from '../constants/messages';
import { UserRole } from '../types/user.interface';
import { JwtPayload } from '../types/auth.interface';
import { Permission, can } from '../constants/permissions';
import { User } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * A signed token is not enough on its own. The role and the account's standing
 * are read back from the database on every request, because the token was
 * minted up to eight hours ago and the Admin may have changed either since:
 * a demoted account kept its old powers until the token expired, a deactivated
 * one kept working, and a password reset left the old session live. The token
 * now only establishes *who* is asking - the database decides what they are.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const account = await User.findById(decoded.userId)
      .select('name email role status sessionsValidFrom')
      .lean();

    if (!account) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED);
    }

    if (account.status !== 'Active') {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your account has been deactivated');
    }

    // `iat` is in seconds; a token minted in the same second as the reset is
    // treated as older, which is the safe direction to round.
    if (account.sessionsValidFrom && decoded.iat) {
      if (decoded.iat * 1000 <= new Date(account.sessionsValidFrom).getTime()) {
        throw new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'Your account was updated by an administrator. Please sign in again.'
        );
      }
    }

    req.user = {
      userId: String(account._id),
      email: account.email,
      name: account.name,
      role: account.role as UserRole,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_EXPIRED));
    }
  }
};

export const authorize = (...allowedRoles: (UserRole | UserRole[])[]) => {
  const flattenedRoles = allowedRoles.flat() as string[];
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
    }

    if (!flattenedRoles.includes(req.user.role)) {
      return next(new ApiError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
    }

    next();
  };
};

/**
 * Route guard expressed in terms of what the staff member is doing rather than
 * a hand-maintained role list, so a role's reach only ever changes in
 * constants/permissions.ts. Any one of the listed permissions is enough.
 */
export const requirePermission = (...permissions: Permission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
    }

    const granted = permissions.some((permission) => can(req.user!.role, permission));
    if (!granted) {
      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Your role (${req.user.role}) is not permitted to perform this action`
        )
      );
    }

    next();
  };
};
