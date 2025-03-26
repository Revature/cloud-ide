// src/types/machines.ts
import { BackendMachine } from '@/types/api';

export interface Machine {
  id: number;
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number; // In GB for frontend display
  storage_size: number; // In GB
  cloudConnectorId?: number;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}

export const convertBackendMachine = (backendMachine: BackendMachine): Machine => {
  if (!backendMachine || typeof backendMachine !== 'object') {
    throw new Error('Invalid machine data provided to converter');
  }
  
  return {
    id: backendMachine.id,
    name: backendMachine.name || 'Unknown Machine',
    identifier: backendMachine.identifier || 'unknown',
    cpu_count: backendMachine.cpu_count || 0,
    // Convert memory size from MB to GB if needed
    memory_size: backendMachine.memory_size >= 1024 ? 
      backendMachine.memory_size / 1024 : 
      backendMachine.memory_size || 0,
    storage_size: backendMachine.storage_size || 0,
    cloudConnectorId: backendMachine.cloud_connector_id,
    createdOn: backendMachine.created_on ? new Date(backendMachine.created_on).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    }) : 'Unknown',
    updatedOn: backendMachine.updated_on ? new Date(backendMachine.updated_on).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    }) : 'Unknown',
    createdBy: backendMachine.created_by || 'Unknown',
    modifiedBy: backendMachine.modified_by || 'Unknown'
  };
};