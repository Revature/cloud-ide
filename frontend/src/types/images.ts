// src/types/images.ts
import { Machine } from './machines';
import { CloudConnector } from './cloudConnectors';
import { ItemWithResourceID } from '@/hooks/useResourceForItems';

export interface Image extends ItemWithResourceID<number> {
  id: number;
  name: string;
  description: string;
  identifier: string;
  runnerPoolSize: number;
  machine?: Machine;
  machineId: number;
  status: string;
  cloudConnector?: CloudConnector;
  cloudConnectorId: number;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
  tags?: string[];
}

export interface ImageRequest {
  name: string;
  description: string;
  machine_id: number;
  cloud_connector_id: number;
  runner_id: number;
  tags: string[];
};

export interface ImageUpdateRequest {
  name: string;
  description: string;
  tags: string[];
};


export interface ImageResponse {
  id: number;
  name: string;
  description: string;
  identifier: string;
  machine_id: number;
  runner_pool_size: number;
  cloud_connector_id: number;
  status: string;
  created_on: string;
  updated_on: string;
  modified_by: string;
  created_by: string;
  tags: string[];
}


export function convertImageResponse(imageResponse: ImageResponse): Image {
  if (!imageResponse || typeof imageResponse !== 'object') {
    throw new Error('Invalid image data provided to converter');
  }

  return {
        id: imageResponse.id,
        name: imageResponse.name,
        identifier: imageResponse.identifier,
        description: imageResponse.description,
        status: imageResponse.status,
        createdOn: new Date(imageResponse.created_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        updatedOn: new Date(imageResponse.updated_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        createdBy: imageResponse.created_by,
        modifiedBy: imageResponse.modified_by,
        cloudConnectorId: imageResponse.cloud_connector_id,
        machineId: imageResponse.machine_id,
        runnerPoolSize: imageResponse.runner_pool_size,
        tags: imageResponse.tags || [],
      };
}
