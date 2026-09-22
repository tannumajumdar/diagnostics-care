import api from './axios';

export const rateHistoryApi = {
  getByTestId: async (testId: string): Promise<any> => api.get(`/rate-history/test/${testId}`),
  getAll: async (params?: any): Promise<any> => api.get('/rate-history', { params }),
};

