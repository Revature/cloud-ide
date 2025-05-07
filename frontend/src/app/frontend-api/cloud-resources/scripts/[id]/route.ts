import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';
import { backendServer } from '../../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';


// Backend API endpoint
const endpoint = `/api/v1/scripts`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(request);

    // Use backendServer to make the request
    const response = await backendServer.get<BackendScript>(`${endpoint}/${id}`);

    // Extract backend data
    const data = response.data;

    // Transform the backend data
    const transformedData: Script = {
      id: data.id,
      name: data.name,
      imageId: data.image_id,
      description: data.description,
      script: data.script,
      event: data.event,
      createdAt: new Date(data.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(data.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: data.created_by,
      modifiedBy: data.modified_by,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'fetch script' });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Use backendServer to make the request
    const response = await backendServer.put<BackendScript>(`${endpoint}/${id}`, body);

    // Extract backend data
    const updatedData = response.data;

    // Transform the backend data
    const transformedData: Script = {
      id: updatedData.id,
      name: updatedData.name,
      imageId: updatedData.image_id,
      description: updatedData.description,
      script: updatedData.script,
      event: updatedData.event,
      createdAt: new Date(updatedData.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(updatedData.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: updatedData.created_by,
      modifiedBy: updatedData.modified_by,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'update script' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Use backendServer to make the request
    await backendServer.delete(`${endpoint}/${id}`);
    console.log(request);

    return NextResponse.json({
      success: true,
      message: `Script with ID ${id} has been successfully deleted.`,
    });
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'delete script' });
  }
}