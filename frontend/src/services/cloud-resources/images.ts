// src/services/cloud-resources/images.ts
import { apiRequest } from '../base';
import { VMImage } from '@/types/images';

export const imagesApi = {
  getAll: () => 
    apiRequest<VMImage[]>('/cloud-resources/images/'),
    
  getById: (id: number) => 
    apiRequest<VMImage>(`/cloud-resources/images/${id}`),
    
  // update: (id: number, data: UpdateVMImage) => 
  //   apiRequest<VMImage>(`/cloud-resources/images/${id}`, {
  //     method: 'PUT',
  //     body: JSON.stringify(data)
  //   }),

  delete: (id: number) => 
    apiRequest<void>(`/cloud-resources/images/${id}`, {
      method: 'DELETE'
    }),
    
  // toggleActive: (id: number, active: boolean) => 
  //   apiRequest<VMImage>(`/cloud-resources/images/${id}/toggle-active`, {
  //     method: 'POST',
  //     body: JSON.stringify({ active })
  //   }),

  patchRunnerPoolSize: (id: number, poolSize: number) =>
    apiRequest<void>(`/cloud-resources/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: { runner_pool_size: poolSize },
    }),

  create: (data: {
    name: string;
    description: string;
    machine_id: number;
    cloud_connector_id?: number;
    runner_id: number;
  }) =>
    apiRequest<void>(`/cloud-resources/images/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};