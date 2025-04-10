// src/types/images.ts
import { Machine } from './machines';
import { CloudConnector } from './cloudConnectors';

export interface VMImage {
  id: number;
  name: string;
  description: string;
  identifier: string;
  runnerPoolSize: number;
  machine?: Machine;
  machineId?: number;
  active: boolean;
  cloudConnector?: CloudConnector;
  cloudConnectorId?: number;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}
