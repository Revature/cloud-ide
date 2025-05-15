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
  status: string;
  image?: string;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}

export interface CloudConnectorRequest {
  provider: string;
  region: string;
  access_key: string;
  secret_key: string;
}

export interface CloudConnectorResponse {
  id: number;
  provider: string; // "aws", "gcp", "azure", etc.
  region: string;
  encrypted_access_key: string;
  encrypted_secret_key: string;
  status: string; // "active", "inactive", etc.
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
}

export function convertCloudConnectorResponse(cloudConnectorResponse: CloudConnectorResponse): CloudConnector {
  if (!cloudConnectorResponse || typeof cloudConnectorResponse !== 'object') {
    throw new Error('Invalid cloud connector data provided to converter');
  }

  return {
        id: cloudConnectorResponse.id,
        provider: cloudConnectorResponse.provider,
        name: `${cloudConnectorResponse.provider} ${cloudConnectorResponse.region}`, // Generated name
        type: cloudConnectorResponse.provider,
        region: cloudConnectorResponse.region,
        status: cloudConnectorResponse.status, // TODO: Default to active
        accessKey: cloudConnectorResponse.encrypted_access_key,
        secretKey: cloudConnectorResponse.encrypted_secret_key,
        createdOn: new Date(cloudConnectorResponse.created_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        updatedOn: new Date(cloudConnectorResponse.updated_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        image: `/images/brand/${cloudConnectorResponse.provider.toLowerCase()}-logo.svg`,
        modifiedBy: cloudConnectorResponse.modified_by,
        createdBy: cloudConnectorResponse.created_by,
      };
}