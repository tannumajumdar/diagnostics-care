import api from './axios';

export const organizationApi = {
  getAll: async (params?: any): Promise<any> => api.get('/organizations', { params }),
  create: async (data: any): Promise<any> => api.post('/organizations', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/organizations/${id}`, data),
};

