import api from './axios';

export const doctorApi = {
  getAll: async (params?: any): Promise<any> => api.get('/doctors', { params }),
  create: async (data: any): Promise<any> => api.post('/doctors', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/doctors/${id}`, data),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/doctors/${id}/status`),
  setCutValue: async (data: { ids: string[]; commission?: number; discountPercentage?: number }): Promise<any> =>
    api.patch('/doctors/bulk/cut-value', data),
};

