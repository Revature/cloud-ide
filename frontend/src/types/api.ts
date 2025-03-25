export interface APIResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface BackendImage {
  id: number;
  name: string;
  description: string;
  identifier: string;
  machine_id: number;
  cloud_connector_id: number;
  active: number | boolean;
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export interface BackendMachine {
  id: number;
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number; // GB
  storage_size: number; // GB
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export interface BackendCloudConnector {
  id: number;
  name: string;
  provider_type: string; // "AWS", "GCP", "Azure", etc.
  region: string;
  active: number | boolean;
  access_key: string;
  secret_key: string;
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}