// src/types/machines.ts
import { BackendMachine } from '@/types/api';

export interface Machine {
  id: number;
  name: string;
  identifier: string;
  cpuCount: number;
  memorySize: number; // In GB for frontend display
  storageSize: number; // In GB
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
    cpuCount: backendMachine.cpu_count || 0,
    // Convert memory size from MB to GB if needed
    memorySize: backendMachine.memory_size >= 1024 ? 
      backendMachine.memory_size / 1024 : 
      backendMachine.memory_size || 0,
    storageSize: backendMachine.storage_size || 0,
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

// Available machine types
export const machineTypes: Machine[] = [
  {
    name: "Small",
    identifier: "t2.small",
    cpuCount: 1,
    memorySize: 2,
    storageSize: 20,
    id: 1
  },
  {
    name: "Medium",
    identifier: "t2.medium",
    cpuCount: 2,
    memorySize: 4,
    storageSize: 50,
    id: 2

  },
  {
    name: "Large",
    identifier: "t2.large",
    cpuCount: 2,
    memorySize: 8,
    storageSize: 100,
    id: 3
  },
  {
    name: "XLarge",
    identifier: "t2.xlarge",
    cpuCount: 4,
    memorySize: 16,
    storageSize: 200,
    id: 4
  },
  {
    name: "2XLarge",
    identifier: "t2.2xlarge",
    cpuCount: 8,
    memorySize: 32,
    storageSize: 500,
    id: 5
  }
];