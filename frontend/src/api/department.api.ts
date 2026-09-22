import api from './axios';

export const departmentApi = {
  getAll: async (params?: any): Promise<any> => api.get('/departments', { params }),
  create: async (data: any): Promise<any> => api.post('/departments', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/departments/${id}`, data),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/departments/${id}/status`),
};

