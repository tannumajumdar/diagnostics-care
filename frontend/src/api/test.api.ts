import api from './axios';

export const testApi = {
  getAll: async (params?: any): Promise<any> => api.get('/tests', { params }),
  create: async (data: any): Promise<any> => api.post('/tests', data),
  update: async (id: string, data: any): Promise<any> => api.put(`/tests/${id}`, data),
  updateRates: async (id: string, rates: any, reason?: string): Promise<any> => api.put(`/tests/${id}/rates`, { rates, reason }),
  toggleStatus: async (id: string): Promise<any> => api.patch(`/tests/${id}/status`),
  remove: async (id: string): Promise<any> => api.delete(`/tests/${id}`),
  updateParameters: async (id: string, parameters: any): Promise<any> => api.put(`/tests/${id}/parameters`, { parameters }),
  getById: async (id: string): Promise<any> => api.get(`/tests/${id}`),
  listAttachments: async (id: string): Promise<any> => api.get(`/tests/${id}/attachments`),
  uploadAttachment: async (id: string, file: { fileName: string; mimeType: string; data: string }): Promise<any> =>
    api.post(`/tests/${id}/attachments`, file),
  /** The file itself, as a Blob. */
  downloadAttachment: async (id: string, attachmentId: string): Promise<Blob> =>
    api.get(`/tests/${id}/attachments/${attachmentId}`, { responseType: 'blob' }),
  /** The Word file this test's report is printed from. */
  uploadReportTemplate: async (id: string, file: { fileName: string; data: string }): Promise<any> =>
    api.put(`/tests/${id}/report-template`, file),
  downloadReportTemplate: async (id: string): Promise<Blob> =>
    api.get(`/tests/${id}/report-template`, { responseType: 'blob' }),
  removeReportTemplate: async (id: string): Promise<any> => api.delete(`/tests/${id}/report-template`),
  removeAttachment: async (id: string, attachmentId: string): Promise<any> =>
    api.delete(`/tests/${id}/attachments/${attachmentId}`),
};
