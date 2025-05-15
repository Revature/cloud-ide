
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


export interface MachineResponse {
  id: number;
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number; // Memory in MB, not GB based on your example
  storage_size: number; // GB
  cloud_connector_id: number; // This was missing in your original interface
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export const convertMachineResponse = (machineResponse: MachineResponse): Machine => {
  if (!machineResponse || typeof machineResponse !== 'object') {
    throw new Error('Invalid machine data provided to converter');
  }
  
  return {
    id: machineResponse.id,
    name: machineResponse.name || 'Unknown Machine',
    identifier: machineResponse.identifier || 'unknown',
    cpuCount: machineResponse.cpu_count || 0,
    // Convert memory size from MB to GB if needed
    memorySize: machineResponse.memory_size >= 1024 ? 
      machineResponse.memory_size / 1024 : 
      machineResponse.memory_size || 0,
    storageSize: machineResponse.storage_size || 0,
    cloudConnectorId: machineResponse.cloud_connector_id,
    createdOn: machineResponse.created_on ? new Date(machineResponse.created_on).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    }) : 'Unknown',
    updatedOn: machineResponse.updated_on ? new Date(machineResponse.updated_on).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    }) : 'Unknown',
    createdBy: machineResponse.created_by || 'Unknown',
    modifiedBy: machineResponse.modified_by || 'Unknown'
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