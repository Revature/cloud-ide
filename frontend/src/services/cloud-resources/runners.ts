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
    
  // create: (data: NewRunner) => 
  //   apiRequest<NewRunner>('/cloud-resources/runners/', {
  //     method: 'POST',
  //     body: JSON.stringify(data)
  //   }),
    
  // update: (id: number, data: UpdateRunner) => 
  //   apiRequest<Runner>(`/cloud-resources/runners/${id}`, {
  //     method: 'PUT',
  //     body: JSON.stringify(data)
  //   }),
    
  // delete: (id: number) => 
  //   apiRequest<void>(`/cloud-resources/runners/${id}`, {
  //     method: 'DELETE'
  //   }),
    
  // toggleActive: (id: number, active: boolean) => 
  //   apiRequest<VMImage>(`/cloud-resources/runners/${id}/toggle-active`, {
  //     method: 'POST',
  //     body: JSON.stringify({ active })
  //   })
};