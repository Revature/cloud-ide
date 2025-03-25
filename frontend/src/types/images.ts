// src/types/images.ts
import { Machine } from './machines';
import { CloudConnector } from './cloudConnectors';

export interface Image {
  id: number;
  name: string;
  description: string;
  identifier: string;
  machine?: Machine;
  active: boolean;
  cloudConnector?: CloudConnector;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}