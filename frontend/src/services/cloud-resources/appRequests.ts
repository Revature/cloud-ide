import { apiRequest } from '../base';
import { BackendAppRequest } from '@/types/api';

export const appRequestsApi = {
  createWithStatus: (data: BackendAppRequest) =>
    apiRequest<{ request_id: string }>(`/cloud-resources/app-requests/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};