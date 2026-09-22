import api from './axios';

export const reportsApi = {
  getDailyRevenue: async (): Promise<any> => api.get('/reports/revenue/daily'),
  getMonthlyRevenue: async (): Promise<any> => api.get('/reports/revenue/monthly'),
  getPatientRegistrations: async (): Promise<any> => api.get('/reports/patients/trend'),
  getTestWiseRevenue: async (): Promise<any> => api.get('/reports/tests/revenue'),
  getDepartmentWiseTests: async (): Promise<any> => api.get('/reports/departments/tests'),
  getDoctorWiseTests: async (): Promise<any> => api.get('/reports/doctors/tests'),
  getPaymentMethods: async (): Promise<any> => api.get('/reports/payments/methods'),
  getPendingDuePayments: async (): Promise<any> => api.get('/reports/payments/pending'),
  getReportCompletionStats: async (): Promise<any> => api.get('/reports/reports/completion'),
  getSampleRejections: async (): Promise<any> => api.get('/reports/samples/rejections'),
  getCorporateRevenue: async (): Promise<any> => api.get('/reports/corporate/revenue'),
};

