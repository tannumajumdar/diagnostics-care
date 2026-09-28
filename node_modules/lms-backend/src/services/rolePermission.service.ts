import { RolePermission } from '../models/rolePermission.model';
import { ALL_ROLES } from '../constants/roles';
import {
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_ROLE,
  PERMISSION_CATALOG,
  isPermission,
  permissionsForRole,
  resetRolePermissions,
  setRolePermissions,
} from '../constants/permissions';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

export class RolePermissionService {
  /**
   * Loads what the Admin saved over the shipped defaults. Called once when the
   * server starts; every save after that updates the live matrix directly.
   */
  static async loadIntoMemory(): Promise<void> {
    const saved = await RolePermission.find().lean();
    saved.forEach((row) => setRolePermissions(row.role, row.permissions || []));
    if (saved.length) console.log(`[LMS Server] Loaded saved permissions for ${saved.length} role(s)`);
  }

  static async getMatrix() {
    const saved = await RolePermission.find().lean();
    const savedByRole = new Map(saved.map((row) => [row.role, row]));

    return {
      catalog: PERMISSION_CATALOG,
      lockedRole: LOCKED_ROLE,
      roles: ALL_ROLES.map((role) => ({
        role,
        locked: role === LOCKED_ROLE,
        permissions: permissionsForRole(role),
        defaults: DEFAULT_ROLE_PERMISSIONS[role] || [],
        customised: savedByRole.has(role),
        updatedBy: savedByRole.get(role)?.updatedBy,
      })),
    };
  }

  static async updateRole(role: string, permissions: unknown, currentUser: JwtPayload) {
    if (!(ALL_ROLES as string[]).includes(role)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Unknown role: ${role}`);
    }
    if (role === LOCKED_ROLE) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The Admin role always has every permission');
    }
    if (!Array.isArray(permissions) || permissions.some((p) => typeof p !== 'string')) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'permissions must be a list');
    }
    const unknown = permissions.filter((p) => !isPermission(p));
    if (unknown.length) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Unknown permission(s): ${unknown.join(', ')}`);
    }

    const clean = Array.from(new Set(permissions as string[]));
    await RolePermission.findOneAndUpdate(
      { role },
      {
        role,
        permissions: clean,
        updatedBy: { userId: String(currentUser?.userId || ''), name: currentUser?.name, at: new Date() },
      },
      { upsert: true, new: true }
    );
    setRolePermissions(role, clean);
    return { role, permissions: permissionsForRole(role) };
  }

  static async resetRole(role: string) {
    if (!(ALL_ROLES as string[]).includes(role)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Unknown role: ${role}`);
    }
    if (role === LOCKED_ROLE) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The Admin role always has every permission');
    }
    await RolePermission.deleteOne({ role });
    resetRolePermissions(role);
    return { role, permissions: permissionsForRole(role) };
  }
}
