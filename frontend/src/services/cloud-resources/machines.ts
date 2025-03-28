// src/services/cloud-resources/machines.ts
import { apiRequest } from '../base';
import { Machine } from '@/types/machines';

export interface NewMachine {
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number;
  storage_size: number;
  cloud_connector_id: number;
}

export interface UpdateMachine {
  name?: string;
  identifier?: string;
  cpu_count?: number;
  memory_size?: number;
  storage_size?: number;
  cloud_connector_id?: number;
}

export const machinesApi = {
  getAll: () => 
    apiRequest<Machine[]>('/cloud-resources/machines/'),
    
  getById: (id: number) => 
    apiRequest<Machine>(`/cloud-resources/machines/${id}`),
    
  // create: (data: NewMachine) => 
  //   apiRequest<Machine>('/cloud-resources/machines/', {
  //     method: 'POST',
  //     body: JSON.stringify(data)
  //   }),
    
  // update: (id: number, data: UpdateMachine) => 
  //   apiRequest<Machine>(`/cloud-resources/machines/${id}`, {
  //     method: 'PUT',
  //     body: JSON.stringify(data)
  //   }),
    
  // delete: (id: number) => 
  //   apiRequest<void>(`/cloud-resources/machines/${id}`, {
  //     method: 'DELETE'
    // }),
    
  // Get all images that use this machine
  // getImages: (id: number) => 
  //   apiRequest<VMImage[]>(`/cloud-resources/machines/${id}/images`)
};