import { RolePermission } from '../models/rolePermission.model';
import { ALL_ROLES } from '../constants/roles';
import {
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_ROLE,
  PERMISSION_CATALOG,
  permissionsForRole,
  setRolePermissions,
} from '../constants/permissions';

/**
 * Each role's starting permissions. Staff are no longer granted access per
 * role - every account carries its own ticked list - so this only supplies
 * what the staff form pre-ticks when a role is picked, and what an account
 * made before per-user permissions still follows.
 */
export class RolePermissionService {
  /**
   * Role matrices an Admin saved on the old Role Permissions screen stay the
   * defaults for their role, so older accounts keep exactly the access they had.
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
}
