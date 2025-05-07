import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import {  NextResponse } from 'next/server';
import { backendServer } from '../../../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: imageId } = await params;

  try {
    // Backend API endpoint
    const endpoint = `/api/v1/scripts/image/${imageId}`;

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
    return handleRouteError(error, { id: imageId, action: 'fetch scripts' });
  }
}