// src/app/frontend-api/cloud-resources/cloud-connectors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { backendServer } from '../../../../../utils/axios'; // Import your backendServer instance
import { CloudConnector } from '@/types/cloudConnectors';
import { BackendCloudConnector } from '@/types/api';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const endpoint = `/api/v1/cloud_connectors/${id}`;
    console.log(request);

    // Use backendServer to make the request
    const response = await backendServer.get<BackendCloudConnector>(endpoint);

    const backendData = response.data;

    const transformedData: CloudConnector = {
      id: backendData.id,
      provider: backendData.provider,
      name: `${backendData.provider} ${backendData.region}`, // Generated name
      type: backendData.provider,
      region: backendData.region,
      active: true, // TODO: Default to active
      accessKey: backendData.encrypted_access_key,
      secretKey: backendData.encrypted_secret_key,
      createdOn: new Date(backendData.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(backendData.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      image: `/images/brand/${backendData.provider.toLowerCase()}-logo.svg`,
      modifiedBy: backendData.modified_by,
      createdBy: backendData.created_by,
    };

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'fetch cloud connector' });
  }
}