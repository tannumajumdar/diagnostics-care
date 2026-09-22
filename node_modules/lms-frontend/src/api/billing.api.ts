import api from './axios';

export const billingApi = {
  getAllInvoices: async (params?: any): Promise<any> => api.get('/billing', { params }),
  getInvoiceById: async (id: string): Promise<any> => api.get(`/billing/${id}`),
  createInvoice: async (data: any): Promise<any> => api.post('/billing', data),
  /** Whole front-desk intake in one call: patient + bill + queued samples. */
  createVisit: async (data: any): Promise<any> => api.post('/billing/visit', data),
  addPayment: async (id: string, data: any): Promise<any> => api.post(`/billing/${id}/payments`, data),
  getByBarcode: async (barcode: string): Promise<any> => api.get(`/billing/barcode/${barcode}`),
};

