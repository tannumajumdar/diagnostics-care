import api from './axios';

export const sampleApi = {
  getAll: async (params?: any): Promise<any> => api.get('/samples', { params }),
  getById: async (id: string): Promise<any> => api.get(`/samples/${id}`),
  getByBarcode: async (barcode: string): Promise<any> => api.get(`/samples/barcode/${barcode}`),
  getStats: async (): Promise<any> => api.get('/samples/stats'),
  getTimeline: async (id: string): Promise<any> => api.get(`/samples/${id}/timeline`),
  updateStatus: async (id: string, data: any): Promise<any> => api.patch(`/samples/${id}/status`, data),
  reject: async (id: string, data: any): Promise<any> => api.patch(`/samples/${id}/reject`, data),
  recollect: async (id: string, data?: any): Promise<any> => api.patch(`/samples/${id}/recollect`, data),
};
