// src/types/cloudConnectors.ts

// Your existing interface
export interface CloudConnector {
  id?: number;
  name: string;
  image?: string;
  type?: string;
  region?: string;
  active?: boolean;
  accessKey?: string;
  secretKey?: string;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}

// For creating new connectors (required fields + no ID)
export type NewCloudConnector = Omit<CloudConnector, 'id' | 'createdOn' | 'updatedOn' | 'modifiedBy' | 'createdBy'> & {
  name: string;
  type: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

// For updating existing connectors (all fields optional)
export type UpdateCloudConnector = Partial<Omit<CloudConnector, 'id' | 'createdOn' | 'updatedOn' | 'modifiedBy' | 'createdBy'>>;