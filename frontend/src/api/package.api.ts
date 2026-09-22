import api from './axios';

/** The test-package master - panels the centre sells at one price. */
export const packageApi = {
  getAll: async (params?: any): Promise<any> => api.get('/packages', { params }),
  getById: async (id: string): Promise<any> => api.get(`/packages/${id}`),
  create: async (data: any): Promise<any> => api.post('/packages', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/packages/${id}`, data),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/packages/${id}/status`),
  remove: async (id: string): Promise<any> => api.delete(`/packages/${id}`),
};
