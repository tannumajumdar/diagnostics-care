import api from './axios';

export interface CreateAppointmentPayload {
  patientId?: string;
  patientName: string;
  mobile: string;
  doctorId: string;
  testIds: string[];
  date: string;
  time: string;
  collectionType: 'Lab Visit' | 'Home Collection';
  address?: string;
  notes?: string;
}

export const appointmentApi = {
  getAll: async (params?: any): Promise<any> => api.get('/appointments', { params }),
  getById: async (id: string): Promise<any> => api.get(`/appointments/${id}`),
  create: async (data: CreateAppointmentPayload): Promise<any> => api.post('/appointments', data),
  updateStatus: async (id: string, data: any): Promise<any> => api.patch(`/appointments/${id}/status`, data),
  assignPhlebotomist: async (id: string, data: any): Promise<any> => api.patch(`/appointments/${id}/assign`, data),
};

