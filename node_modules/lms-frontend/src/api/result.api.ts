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
};

/**
 * Saves the visit's report as a PDF file. Fetched with the login token like
 * every other call - opening the bare URL in a new tab carried no token, so
 * the server refused it and nothing was ever saved.
 */
export const saveReportPdf = async (resultId: string, _patientName?: string, _reportNo?: string) => {
  // Filed in the Saved Reports register first, then that very file is
  // downloaded - so what the patient got is what the register holds.
  const saved: any = await savedReportApi.saveFromResult(resultId);
  await downloadSavedReport(saved._id, saved.fileName);
  return saved.fileName as string;
};

/** Every saved report PDF, kept to be found and downloaded again. */
export const savedReportApi = {
  list: async (params?: any): Promise<any> => api.get('/saved-reports', { params }),
  saveFromResult: async (resultId: string, options?: { provisional?: boolean }): Promise<any> =>
    api.post(`/saved-reports/from-result/${resultId}`, options),
  file: async (id: string): Promise<Blob> => api.get(`/saved-reports/${id}/file`, { responseType: 'blob' }),
};

const fetchSavedFile = async (id: string): Promise<Blob> => {
  try {
    const blob = await savedReportApi.file(id);
    return new Blob([blob], { type: 'application/pdf' });
  } catch (error) {
    throw new Error(await readBlobError(error));
  }
};

/** Opens a saved report in a new tab to view or print. */
export const openSavedReport = async (id: string) => {
  const url = URL.createObjectURL(await fetchSavedFile(id));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadSavedReport = async (id: string, fileName: string) => {
  const url = URL.createObjectURL(await fetchSavedFile(id));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return fileName;
};

