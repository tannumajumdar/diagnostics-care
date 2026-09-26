import api from './axios';

export const resultApi = {
  getAll: async (params?: any): Promise<any> => api.get('/results', { params }),
  /** Every patient's entered results, one row per visit. */
  getPatientReports: async (params?: any): Promise<any> => api.get('/results/patient-reports', { params }),
  getPending: async (params?: any): Promise<any> => api.get('/results/pending', { params }),
  getBySampleId: async (sampleId: string): Promise<any> => api.get(`/results/sample/${sampleId}`),
  /** Every test billed on the same visit as this sample, one sheet each. */
  getVisitBySampleId: async (sampleId: string): Promise<any> => api.get(`/results/visit/${sampleId}`),
  getById: async (id: string): Promise<any> => api.get(`/results/${id}`),
  saveDraft: async (data: any): Promise<any> => api.post('/results/draft', data),
  submit: async (data: any): Promise<any> => api.post('/results/submit', data),
  verify: async (id: string, data: any): Promise<any> => api.patch(`/results/${id}/verify`, data),
  downloadReport: async (id: string): Promise<any> => api.get(`/results/${id}/pdf`, { responseType: 'blob' }),
  getPDFUrl: (id: string): string => `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/results/${id}/pdf`,
};

