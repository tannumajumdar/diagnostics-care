import api from './axios';

export const patientApi = {
  getAll: async (params?: any): Promise<any> => api.get('/patients', { params }),
  getById: async (id: string): Promise<any> => api.get(`/patients/${id}`),
  /** The whole record organised by visit - bills, tests, reports, payments. */
  getHistory: async (id: string): Promise<any> => api.get(`/patients/${id}/history`),
  create: async (data: any): Promise<any> => api.post('/patients', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/patients/${id}`, data),
};

