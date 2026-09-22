import api from './axios';

export const testApi = {
  getAll: async (params?: any): Promise<any> => api.get('/tests', { params }),
  create: async (data: any): Promise<any> => api.post('/tests', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/tests/${id}`, data),
  updateRates: async (id: string, rates: any, reason?: string): Promise<any> => api.put(`/tests/${id}/rates`, { rates, reason }),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/tests/${id}/status`),
  remove: async (id: string): Promise<any> => api.delete(`/tests/${id}`),
  updateParameters: async (id: string, parameters: any): Promise<any> => api.put(`/tests/${id}/parameters`, { parameters }),
};
