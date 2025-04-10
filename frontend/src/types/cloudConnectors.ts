// src/types/cloudConnectors.ts

// Your existing interface
export interface CloudConnector {
  id: number;
  provider: string;
  name?: string;
  region: string;
  accessKey: string;
  type?:string;
  secretKey: string;
  active?: boolean;
  image?: string;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}

// For creating new connectors (required fields + no ID)
export type NewCloudConnector = Omit<CloudConnector, 'id' | 'createdOn' | 'updatedOn' | 'modifiedBy' | 'createdBy' | 'active'> & {
  provider: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

// For updating existing connectors (all fields optional)
export type UpdateCloudConnector = Partial<Omit<CloudConnector, 'id' | 'createdOn' | 'updatedOn' | 'modifiedBy' | 'createdBy' | 'active'>>;