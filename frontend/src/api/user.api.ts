import api from './axios';

export const userApi = {
  getAll: async (params?: any): Promise<any> => api.get('/users', { params }),
  getById: async (id: string): Promise<any> => api.get(`/users/${id}`),
  /** Active phlebotomists and technicians, for assigning a home visit. */
  getCollectors: async (): Promise<any> => api.get('/users/collectors'),
  /** Active staff names and roles, for the payment ledger's cashier filter. */
  getCashiers: async (): Promise<any> => api.get('/users/cashiers'),
  create: async (data: any): Promise<any> => api.post('/users', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/users/${id}`, data),
  /** Admin sets a new password for someone else; no old password needed. */
  resetPassword: async (id: string, password: string): Promise<any> =>
    api.patch(`/users/${id}/password`, { password }),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/users/${id}/status`),
};
