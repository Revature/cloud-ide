// src/services/cloud-resources/cloudConnectors.ts
import { apiRequest } from '../base';
import { 
  CloudConnector, 
} from '@/types/cloudConnectors';
import { BackendCloudConnectorRequest } from '@/types/api';

export const cloudConnectorsApi = {
  getAll: () => 
    apiRequest<CloudConnector[]>('/cloud-resources/cloud-connectors/'),
    
  getById: (id: number) => 
    apiRequest<CloudConnector>(`/cloud-resources/cloud-connectors/${id}`),

  create: (connector: BackendCloudConnectorRequest) => 
    apiRequest<CloudConnector>('/cloud-resources/cloud-connectors/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connector),
    }),

  // update: (id: number, connector: UpdateCloudConnector) => 
  //   apiRequest<CloudConnector>(`/cloud_connectors/${id}`, {
  //     method: 'PUT',
  //     body: connector,
  //   }),

  toggle: (id: number, status: object) => 
    apiRequest<CloudConnector>(`/cloud-resources/cloud-connectors/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(status),
    }),
    
  delete: (id: number) => 
    apiRequest<void>(`/cloud-resources/cloud_connectors/${id}`, {
      method: 'DELETE',
    }),
};