import api from './axios';

export const authApi = {
  login: async (credentials: any): Promise<any> => api.post('/auth/login', credentials),
  getProfile: async (): Promise<any> => api.get('/auth/me'),
  getCurrentUser: async (): Promise<any> => api.get('/auth/me'),
};

