import { ItemWithResourceID } from "@/hooks/useResourceForItems";
import { Image } from "./images";
import { Machine } from "./machines";

// Define runner states
export type RunnerState = "starting" | "ready" | "awaiting_client" | "active" | "terminated" | "runner_starting" | "ready_claimed" | "closed" | "closed_pool";

// Define the frontend runner interface (camelCase for frontend use)
export interface Runner extends ItemWithResourceID<number> {
  id: number;
  userId?: number; // Optional because runners in the pool don't have a user yet
  image?: Image;
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
  terminalToken?: string; // Token for the terminal session
  userEmail?: string; // Optional, can be used for user identification
}

export interface RunnerResponse{
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
  terminal_token: string,
  lifecycle_token: string,
  user_email?: string,
}


export const convertRunnerResponse = (runnerResponse: RunnerResponse): Runner => {
  if (!runnerResponse || typeof runnerResponse !== 'object') {
    throw new Error('Invalid machine data provided to converter');
  }

   return {
        id: runnerResponse.id,
        userId: runnerResponse.user_id,
        imageId: runnerResponse.image_id,
        machineId: runnerResponse.machine_id,
        keyId: runnerResponse.key_id,
        state: runnerResponse.state,
        identifier: runnerResponse.identifier,
        externalHash: runnerResponse.external_hash,
        url: runnerResponse.url,
        userIP: runnerResponse.user_ip,
        envData: runnerResponse.env_data,
        sessionStart: new Date(runnerResponse.session_start).toLocaleString('en-US'),
        sessionEnd: new Date(runnerResponse.session_end).toLocaleString('en-US'),
        endedOn: new Date(runnerResponse.ended_on).toLocaleString('en-US'),
        createdOn: new Date(runnerResponse.created_on).toLocaleDateString('en-US'),
        updatedOn: new Date(runnerResponse.updated_on).toLocaleDateString('en-US'),
        modifiedBy: runnerResponse.modified_by,
        terminalToken: runnerResponse.terminal_token,
        userEmail: runnerResponse.user_email,
      };
}