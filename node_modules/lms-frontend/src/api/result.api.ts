import api from './axios';

/**
 * A file request that fails still comes back as a Blob, so the server's
 * message is read out of it rather than showing "[object Blob]".
 */
export const readBlobError = async (error: any): Promise<string> => {
  if (error instanceof Blob) {
    try {
      const body = JSON.parse(await error.text());
      return body?.message || 'The file could not be generated';
    } catch {
      return 'The file could not be generated';
    }
  }
  return error?.message || 'The file could not be generated';
};

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
  /** One test's report in the Word format uploaded on that test, as a Blob. */
  downloadDocx: async (id: string): Promise<Blob> => api.get(`/results/${id}/docx`, { responseType: 'blob' }),
  getPDFUrl: (id: string): string => `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/results/${id}/pdf`,
};

