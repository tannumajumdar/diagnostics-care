import api from './axios';

export interface PermissionCatalogEntry {
  group: string;
  key: string;
  label: string;
  description: string;
}

export interface RolePermissionRow {
  role: string;
  locked: boolean;
  permissions: string[];
  defaults: string[];
  customised: boolean;
  updatedBy?: { userId?: string; name?: string; at?: string };
}

export interface RolePermissionMatrix {
  catalog: PermissionCatalogEntry[];
  lockedRole: string;
  roles: RolePermissionRow[];
}

export const rolePermissionApi = {
  getMatrix: async (): Promise<RolePermissionMatrix> => api.get('/role-permissions'),
  updateRole: async (role: string, permissions: string[]): Promise<any> =>
    api.put(`/role-permissions/${encodeURIComponent(role)}`, { permissions }),
  resetRole: async (role: string): Promise<any> => api.delete(`/role-permissions/${encodeURIComponent(role)}`),
};
