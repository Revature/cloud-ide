import { AppRequest } from '@/types/app-requests';
import { apiRequest } from '../base';

export const appRequestsApi = {
  createWithStatus: (data: AppRequest) =>
    apiRequest<{ lifecycle_token: string, url: string }>(`/cloud-resources/app-requests/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};