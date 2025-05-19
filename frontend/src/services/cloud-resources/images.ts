// src/services/cloud-resources/images.ts
import { apiRequest } from '../base';
import { Image, ImageRequest, ImageUpdateRequest } from '@/types/images';

export const imagesApi = {
  getAll: () => 
    apiRequest<Image[]>('/cloud-resources/images/'),
    
  getById: (id: number) => 
    apiRequest<Image>(`/cloud-resources/images/${id}`),
    
  update: (id: number, data: ImageUpdateRequest) => 
    apiRequest<Image>(`/cloud-resources/images/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: (id: number) => 
    apiRequest<void>(`/cloud-resources/images/${id}`, {
      method: 'DELETE'
    }),
    
  toggle: (id: number, is_active: boolean) => 
    apiRequest<Image>(`/cloud-resources/images/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    }),

  patchRunnerPoolSize: (id: number, poolSize: number) =>
    apiRequest<void>(`/cloud-resources/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: { runner_pool_size: poolSize },
    }),

  create: (data: ImageRequest) =>
    apiRequest<Image>(`/cloud-resources/images/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};