// src/types/images.ts
import { Machine } from './machines';
import { CloudConnector } from './cloudConnectors';

export interface VMImage {
  id: number;
  name: string;
  description: string;
  identifier: string;
  machine?: Machine;
  machine_id?: number;
  active: boolean;
  cloudConnector?: CloudConnector;
  cloudConnector_id?: number;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}