// src/types/api.ts

import { RunnerState } from "./runner";

export interface APIResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface BackendVMImage {
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
  memory_size: number; // Memory in MB, not GB based on your example
  storage_size: number; // GB
  cloud_connector_id: number; // This was missing in your original interface
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export interface BackendCloudConnector {
  id: number;
  provider: string; // "aws", "gcp", "azure", etc.
  region: string;
  encrypted_access_key: string;
  encrypted_secret_key: string;
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export interface BackendRunner{
  id: number,
  machine_id: number;
  image_id: number,
  user_id: number,
  key_id: number,
  state: RunnerState,
  url: string,
  user_ip: string,
  identifier: string,
  external_hash: string,
  env_data: JSON,
  session_start: string,
  session_end: string,
  ended_on: string,
  created_on: string,
  updated_on: string,
  modified_by: string,
  created_by: string,
}