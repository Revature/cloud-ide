import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';


// Backend API endpoint
const endpoint = '/api/v1/scripts/';

export async function GET() {
  try {
    // Use backendServer to make the request
    const response = await backendServer.get<BackendScript[]>(endpoint);

    // Extract backend data
    const data = response.data;

    // Transform the backend data
    const transformedData: Script[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      imageId: item.image_id,
      description: item.description,
      script: item.script,
      event: item.event,
      createdAt: new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(item.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: item.created_by,
      modifiedBy: item.modified_by,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetch scripts' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Use backendServer to make the request
    const response = await backendServer.post<BackendScript>(endpoint, body);

    // Extract backend data
    const createdData = response.data;

    // Transform the backend data
    const transformedData: Script = {
      id: createdData.id,
      name: createdData.name,
      imageId: createdData.image_id,
      description: createdData.description,
      script: createdData.script,
      event: createdData.event,
      createdAt: new Date(createdData.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(createdData.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: createdData.created_by,
      modifiedBy: createdData.modified_by,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'create script' });
  }
}