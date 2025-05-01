// src/services/cloud-resources/images.ts
import { Runner } from '@/types/runner';
import { apiRequest } from '../base';

export interface NewRunner {
  imageId: number;
  machineId: number;
  keyId: number;
  indentifier: string;
  envData: JSON;
  userIp: string;
}

export interface UpdateRunner {
  state: string;
  envData: JSON;
  userIp: string;
}

export const runnersApi = {
  getAll: () => 
    apiRequest<Runner[]>('/cloud-resources/runners/'),
    
  getById: (id: number) => 
    apiRequest<Runner>(`/cloud-resources/runners/${id}`),


  terminate: (id: number) =>
    apiRequest<void>(`/cloud-resources/runners/${id}`, {
      method: 'DELETE',
    }),

  changeState: (id: number, action: 'start' | 'stop') =>
    apiRequest<void>(`/cloud-resources/runners/${id}?action=${action}`, {
      method: 'PATCH',
    }),

};