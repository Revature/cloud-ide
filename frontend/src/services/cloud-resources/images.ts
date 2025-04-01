// src/services/cloud-resources/images.ts
import { apiRequest } from '../base';
import { VMImage } from '@/types/images';

export interface NewVMImage {
  name: string;
  description: string;
  identifier: string;
  machine_id: number;
  cloud_connector_id: number;
  active?: boolean;
}

export interface UpdateVMImage {
  name?: string;
  description?: string;
  identifier?: string;
  machine_id?: number;
  cloud_connector_id?: number;
  active?: boolean;
}

export const imagesApi = {
  getAll: () => 
    apiRequest<VMImage[]>('/cloud-resources/images/'),
    
  getById: (id: number) => 
    apiRequest<VMImage>(`/cloud-resources/images/${id}`),
    
  // create: (data: NewVMImage) => 
  //   apiRequest<VMImage>('/cloud-resources/images/', {
  //     method: 'POST',
  //     body: JSON.stringify(data)
  //   }),
    
  // update: (id: number, data: UpdateVMImage) => 
  //   apiRequest<VMImage>(`/cloud-resources/images/${id}`, {
  //     method: 'PUT',
  //     body: JSON.stringify(data)
  //   }),
    
  // delete: (id: number) => 
  //   apiRequest<void>(`/cloud-resources/images/${id}`, {
  //     method: 'DELETE'
  //   }),
    
  // toggleActive: (id: number, active: boolean) => 
  //   apiRequest<VMImage>(`/cloud-resources/images/${id}/toggle-active`, {
  //     method: 'POST',
  //     body: JSON.stringify({ active })
  //   })
};