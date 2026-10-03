import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { repo, regexAny } from '../db/repo';
import { hashIfSet } from '../db/passwords';
import { queryValue } from '../db/rules';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';
import { LOCKED_ROLE, effectivePermissions, isPermission } from '../constants/permissions';
import { ROLES } from '../constants/roles';
import { logAuditAction } from '../utils/auditLogger';

/** A staff account as read through db/repo - the shape the User model sent. */
type IUserDocument = any;

/** The Admin performing the action, for the audit trail. */
const actorOf = (req: Request) => ({
  id: req.user?.userId,
  name: req.user?.name,
  role: req.user?.role,
});

/**
 * An Admin may change anyone's account, including another Admin's - but not
 * the last one standing. Locking out or demoting the final active Admin would
 * leave the centre with nobody able to add staff, reset a password or approve
 * a payout, and there is no tier above Admin to recover from it.
 */
const assertNotLastActiveAdmin = async (target: IUserDocument, next: { role?: string; status?: string }) => {
  const wasActiveAdmin = target.role === ROLES.ADMIN && target.status === 'Active';
  if (!wasActiveAdmin) return;

  const staysActiveAdmin =
    (next.role ?? target.role) === ROLES.ADMIN && (next.status ?? target.status) === 'Active';
  if (staysActiveAdmin) return;

  const activeAdmins = await repo.count('user', { role: ROLES.ADMIN, status: 'Active' });
  if (activeAdmins <= 1) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'This is the last active Admin account. Promote another member to Admin first.'
    );
  }
};

/**
 * Everything already issued to this account stops working. Used when the
 * Admin resets a password, changes a role or deactivates someone - without
 * it the old session simply carried on for the rest of its eight hours.
 */
const revokeSessions = (user: IUserDocument) => {
  user.sessionsValidFrom = new Date();
  user.refreshToken = undefined;
};

/**
 * The permissions to store for an account. `undefined` means "follow the
 * role", which is also what an Admin always gets - the Admin has everything
 * and there is nothing to tick.
 */
const cleanPermissions = (role: string, permissions: unknown): string[] | undefined => {
  if (role === LOCKED_ROLE || permissions === undefined || permissions === null) return undefined;
  if (!Array.isArray(permissions)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'permissions must be a list');
  }
  const unknown = permissions.filter((p) => typeof p !== 'string' || !isPermission(p));
  if (unknown.length) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Unknown permission(s): ${unknown.join(', ')}`);
  }
  return Array.from(new Set(permissions as string[]));
};

const samePermissions = (a?: string[], b?: string[]) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((p) => b.includes(p)));

/** An account as the staff screen shows it: what it can do, and whether that was ticked by hand. */
const withPermissions = (user: IUserDocument) => ({
  ...user,
  permissions: effectivePermissions(user),
  customPermissions: user.role !== LOCKED_ROLE && Array.isArray(user.permissions),
});

export class UserController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, role, status, page = 1, limit = 10 } = req.query;
      const filter: any = { AND: [] };
      if (search) filter.AND.push(await regexAny('user', ['name', 'email'], String(search)));
      if (role) filter.role = role;
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [users, total] = await Promise.all([
        repo.find('user', { where: filter, orderBy: { name: 'asc' }, skip, take: Number(limit) }),
        repo.count('user', filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Users retrieved',
        // What each person may do, read off the same list the API enforces.
        data: users.map(withPermissions),
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return UserController.getAll(req, res, next);
  };

  /**
   * The people who can be sent out on a draw. The front desk assigns home
   * collections but has no business reading the full staff register, so this
   * returns names and roles only.
   */
  static getCollectors = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const collectors = (
        await prisma.user.findMany({
          where: { role: { in: ['Phlebotomist', 'Lab Technician'] }, status: 'Active' },
          select: { id: true, name: true, role: true, mobile: true },
          orderBy: { name: 'asc' },
        })
      ).map(({ id, ...rest }) => ({ _id: id, ...rest }));

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Collection staff retrieved', data: collectors });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Everyone who can take a payment or pay one out, for filtering the ledger
   * by shift cashier. Names and roles only - not the staff register.
   */
  static getCashiers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cashiers = (
        await prisma.user.findMany({
          where: { status: 'Active' },
          select: { id: true, name: true, role: true },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
        })
      ).map(({ id, ...rest }) => ({ _id: id, ...rest }));

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Cashiers retrieved', data: cashiers });
    } catch (error) {
      next(error);
    }
  };

  static getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await repo.findById('user', id);
      if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'User retrieved', data: user });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password, role, mobile, status } = req.body;
      const permissions = cleanPermissions(role, req.body.permissions);

      const existing = await repo.findOne('user', { email: queryValue('user', 'email', String(email)) });
      if (existing) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `A staff account already exists for ${email}`);
      }

      const user = await repo.create(
        'user',
        { name, email, password, role, mobile, status, permissions },
        { transform: hashIfSet(password) }
      );

      logAuditAction({
        action: 'STAFF_CREATE',
        module: 'STAFF',
        user: actorOf(req),
        ipAddress: req.ip,
        targetId: user._id.toString(),
        details: { name: user.name, email: user.email, role: user.role, permissions: user.permissions },
      });

      const obj: any = withPermissions(user);
      delete obj.password;
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: `${user.name} added as ${user.role}`,
        data: obj,
      });
    } catch (error) {
      next(error);
    }
  };

  static createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return UserController.create(req, res, next);
  };

  static updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await repo.findById('user', id, { omit: { password: false } });
      if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');

      const { name, email, role, mobile, status, password } = req.body;
      const isSelf = req.user?.userId === user._id.toString();

      // An Admin editing their own row cannot hand away the role or switch
      // themselves off - both are one click from being locked out of the
      // screen that would undo it.
      if (isSelf && role !== undefined && role !== user.role) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'You cannot change your own role');
      }
      if (isSelf && status !== undefined && status !== user.status) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'You cannot change your own account status');
      }

      // A new role with no list sent goes back to that role's defaults rather
      // than keeping ticks chosen for the old one.
      const nextRole = role ?? user.role;
      const permissionsSent = req.body.permissions !== undefined;
      const nextPermissions = permissionsSent
        ? cleanPermissions(nextRole, req.body.permissions)
        : role !== undefined && role !== user.role
          ? undefined
          : cleanPermissions(nextRole, user.permissions);
      const permissionsChanged = !samePermissions(user.permissions, nextPermissions);
      if (isSelf && permissionsChanged) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'You cannot change your own permissions');
      }

      await assertNotLastActiveAdmin(user, { role, status });

      // Caught here so a clashing address comes back as a sentence rather
      // than a raw duplicate-key error from the driver.
      if (email !== undefined && String(email).toLowerCase() !== user.email) {
        const clash = await repo.findOne('user', { email: queryValue('user', 'email', String(email)), id: { not: user._id } });
        if (clash) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, `A staff account already exists for ${email}`);
        }
      }

      const changed: string[] = [];
      const roleChanged = role !== undefined && role !== user.role;
      const deactivated = status !== undefined && status !== user.status && status !== 'Active';

      if (name !== undefined && name !== user.name) changed.push('name');
      if (email !== undefined && String(email).toLowerCase() !== user.email) changed.push('email');
      if (mobile !== undefined && mobile !== user.mobile) changed.push('mobile');
      if (roleChanged) changed.push(`role (${user.role} -> ${role})`);
      if (status !== undefined && status !== user.status) changed.push(`status (${status})`);
      if (permissionsChanged) changed.push('permissions');
      if (password) changed.push('password');

      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = email;
      if (role !== undefined) user.role = role;
      if (mobile !== undefined) user.mobile = mobile;
      if (status !== undefined) user.status = status;
      if (permissionsChanged) user.permissions = nextPermissions;
      // Assigned through save() so the hashing hook runs - findByIdAndUpdate
      // bypasses it and would have written the new password in clear text.
      if (password) user.password = password;

      // A new password, a new role or a switched-off account has to reach the
      // person now. Never for the Admin doing the editing, who would otherwise
      // sign themselves out by correcting their own phone number.
      if (!isSelf && (password || roleChanged || deactivated || permissionsChanged)) {
        revokeSessions(user);
      }

      const saved = await repo.save('user', user, { transform: hashIfSet(password || undefined) });

      if (changed.length) {
        logAuditAction({
          action: password ? 'STAFF_PASSWORD_RESET' : 'STAFF_UPDATE',
          module: 'STAFF',
          user: actorOf(req),
          ipAddress: req.ip,
          targetId: user._id.toString(),
          // The new password itself is never recorded - only that it was reset.
          // Read off the saved row: Mongoose trimmed a name as it was assigned.
          details: { target: saved.name, targetRole: saved.role, changed },
        });
      }

      const obj: any = withPermissions(saved);
      delete obj.password;
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Staff account updated', data: obj });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Set someone else's password without knowing the old one. This is the
   * Admin's recovery path - a receptionist who is locked out has no other way
   * back in, since the self-service change requires the password they lost.
   */
  static resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await repo.findById('user', id, { omit: { password: false } });
      if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');

      const { password } = req.body;
      user.password = password;

      const isSelf = req.user?.userId === user._id.toString();
      if (!isSelf) revokeSessions(user);

      await repo.save('user', user, { transform: hashIfSet(password) });

      logAuditAction({
        action: 'STAFF_PASSWORD_RESET',
        module: 'STAFF',
        user: actorOf(req),
        ipAddress: req.ip,
        targetId: user._id.toString(),
        details: { target: user.name, targetRole: user.role },
      });

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `Password reset for ${user.name}. They will need to sign in again.`,
      });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      let user = await repo.findById('user', id);
      if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');

      if (req.user?.userId === user._id.toString()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'You cannot change your own account status');
      }

      const next_ = user.status === 'Active' ? 'Inactive' : 'Active';
      await assertNotLastActiveAdmin(user, { status: next_ });

      user.status = next_;
      // Switching someone off has to take hold immediately, not whenever
      // their current token happens to run out.
      if (next_ !== 'Active') revokeSessions(user);
      user = await repo.save('user', user);

      logAuditAction({
        action: next_ === 'Active' ? 'STAFF_ACTIVATE' : 'STAFF_DEACTIVATE',
        module: 'STAFF',
        user: actorOf(req),
        ipAddress: req.ip,
        targetId: user._id.toString(),
        details: { target: user.name, targetRole: user.role },
      });

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: `${user.name} is now ${next_}`, data: user });
    } catch (error) {
      next(error);
    }
  };
}
