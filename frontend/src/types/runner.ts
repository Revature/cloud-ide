import { VMImage } from "./images";
import { Machine } from "./machines";

// Define runner states
export type RunnerState = "starting" | "ready" | "awaiting_client" | "active" | "terminated";

// Define the runner interface
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
  userIP?:string;
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
