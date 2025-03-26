// src/services/cloud-resources/cloudConnectors.ts
import { apiRequest } from '../base';
import { 
  CloudConnector, 
  // NewCloudConnector, 
  // UpdateCloudConnector 
} from '@/types/cloudConnectors';

export const cloudConnectorsApi = {
  getAll: () => 
    apiRequest<CloudConnector[]>('/cloud-resources/cloud-connectors/'),
    
  getById: (id: number) => 
    apiRequest<CloudConnector>(`/cloud-resources/cloud-connectors/${id}`),
    
  // create: (connector: NewCloudConnector) => 
  //   apiRequest<CloudConnector>('/cloud_connectors/', {
  //     method: 'POST',
  //     body: connector,
  //   }),
    
  // update: (id: number, connector: UpdateCloudConnector) => 
  //   apiRequest<CloudConnector>(`/cloud_connectors/${id}`, {
  //     method: 'PUT',
  //     body: connector,
  //   }),

  // toggle: (id: number, active: boolean) => 
  //   apiRequest<CloudConnector>(`/cloud_connectors/${id}/toggle`, {
  //     method: 'PATCH',
  //     body: { active },
  //   }),
    
  // delete: (id: number) => 
  //   apiRequest<void>(`/cloud_connectors/${id}`, {
  //     method: 'DELETE',
  //   }),
};