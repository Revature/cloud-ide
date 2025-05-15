// src/app/frontend-api/cloud-resources/cloud-connectors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector, CloudConnectorResponse, convertCloudConnectorResponse } from '@/types/cloudConnectors';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const endpoint = `/api/v1/cloud_connectors/${id}`;
    console.log(request);

    // Use backendServer to make the request
    const response = await backendServer.get<CloudConnectorResponse>(endpoint);

    const backendData = response.data;

    const transformedData: CloudConnector = convertCloudConnectorResponse(backendData);

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'fetch cloud connector' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const endpoint = `/api/v1/cloud_connectors/${id}`;
    console.log(`Deleting cloud connector with ID: ${id}`);

    // Use backendServer to send the DELETE request
    await backendServer.delete(endpoint);

    // Return a success response
    return NextResponse.json({ message: `Cloud connector with ID ${id} deleted successfully.` });
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'delete cloud connector' });
  }
}