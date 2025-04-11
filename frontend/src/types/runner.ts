import { VMImage } from "./images";
import { Machine } from "./machines";

// Define runner states
export type RunnerState = "starting" | "ready" | "awaiting_client" | "active" | "terminated";

// Define the backend runner interface (snake_case as returned by API)
export interface BackendRunner {
  id: number;
  user_id?: number;
  image_id: number;
  machine_id: number;
  key_id: number;
  state: RunnerState;
  identifier: string;
  external_hash: string;
  url?: string;
  user_ip?: string;
  env_data?: JSON;
  session_start?: string;
  session_end?: string;
  ended_on?: string;
  created_on: string;
  updated_on: string;
  modified_by?: string;
}

// Define the frontend runner interface (camelCase for frontend use)
export interface Runner {
  id: number;
  userId?: number; // Optional because runners in the pool don't have a user yet
  image?: VMImage;
  imageId: number;
  machine?: Machine;
  machineId: number;
  keyId: number;
  state: RunnerState;
  identifier: string;
  externalHash: string;
  url?: string; // Will be populated when the runner is ready
  userIP?: string;
  envData?: JSON;
  sessionStart?: string; // When user requests runner
  sessionEnd?: string; // When runner expires
  endedOn?: string;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
}

// Define a separate interface for new runners
export type NewRunner = Omit<Runner, 'id' | 'createdOn' | 'updatedOn' | 'modifiedBy' | 'createdBy' | 'active' | 'machineId' | 'imageId' | 'keyId' | 'state' | 'identifier' | 'externalHash'> & {
  image: VMImage;
  durationMinutes: number;
}