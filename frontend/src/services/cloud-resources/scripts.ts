import { Script } from '@/types/scripts';
import { apiRequest } from '../base';
import { BackendScript } from '@/types/api';

export const scriptsApi = {
  getAll: () =>
    apiRequest<Script[]>('/cloud-resources/scripts/'),

  getById: (id: number) =>
    apiRequest<Script>(`/cloud-resources/scripts/${id}`),

  create: (script: Omit<BackendScript, 'id' | 'created_at' | 'updated_at' | 'modified_by' | 'created_by'>) =>
    apiRequest<BackendScript>('/cloud-resources/scripts/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    }),

  update: (id: number, script: Partial<BackendScript>) =>
    apiRequest<BackendScript>(`/cloud-resources/scripts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    }),

  delete: (id: number) =>
    apiRequest<void>(`/cloud-resources/scripts/${id}`, {
      method: 'DELETE',
    }),
};