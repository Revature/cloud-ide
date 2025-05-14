import { Script, ScriptRequest } from '@/types/scripts';
import { apiRequest } from '../base';

export const scriptsApi = {
  getAll: () =>
    apiRequest<Script[]>('/cloud-resources/scripts/'),

  getAllByImageId: (id: number) =>
    apiRequest<Script[]>(`/cloud-resources/scripts/image/${id}`),

  getById: (id: number) =>
    apiRequest<Script>(`/cloud-resources/scripts/${id}`),

  create: (script: ScriptRequest) =>
    apiRequest<Script>('/cloud-resources/scripts/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    }),

  update: (id: number, script: Partial<ScriptRequest>) =>
    apiRequest<Script>(`/cloud-resources/scripts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    }),

  delete: (id: number) =>
    apiRequest<void>(`/cloud-resources/scripts/${id}`, {
      method: 'DELETE',
    }),
};