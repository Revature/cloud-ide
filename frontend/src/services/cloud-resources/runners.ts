// src/services/cloud-resources/images.ts
import { Runner } from '@/types/runner';
import { apiRequest } from '../base';
import { BackendAppRequest } from '@/types';

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
    
  create: (data: BackendAppRequest) => 
    apiRequest<BackendAppRequest>('/cloud-resources/runners/', {
      method: 'POST',
      body: data
    }),
    
  createWithStatus: (data: BackendAppRequest) =>
    apiRequest<{ request_id: string }>(`/cloud-resources/runners/with_status`, {
      method: 'POST',
      body: data,
    }),

  terminate: (id: number) =>
    apiRequest<void>(`/cloud-resources/runners/${id}`, {
      method: 'DELETE',
    }),

  start: (id: number) =>
    apiRequest<void>(`/cloud-resources/runners/${id}/start`, {
      method: 'PATCH',
    }),

  stop: (id: number) =>
    apiRequest<void>(`/cloud-resources/runners/${id}/stop`, {
      method: 'PATCH',
    }),
};