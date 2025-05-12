// src/app/frontend-api/cloud-resources/images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VMImage } from '@/types/images';
import { BackendVMImage } from '@/types/api';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


const endpoint = '/api/v1/images/';

export async function GET() {
  try {

    const response = await backendServer.get<BackendVMImage[]>(endpoint);

    const backendData = response.data;

    const transformedData: VMImage[] = backendData.map((item: BackendVMImage) => ({
      id: item.id,
      name: item.name,
      identifier: item.identifier,
      description: item.description,
      status: item.status,
      createdOn: new Date(item.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(item.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: item.created_by,
      modifiedBy: item.modified_by,
      cloudConnectorId: item.cloud_connector_id,
      machineId: item.machine_id,
      runnerPoolSize: item.runner_pool_size,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetch images' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await backendServer.post(endpoint, body);

    const responseData = response.data;

    return NextResponse.json(responseData);
  } catch (error) {
    return handleRouteError(error, { action: 'create image' });
  }
}