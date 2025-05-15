import { convertScriptResponse, Script, ScriptResponse } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


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
    const response = await backendServer.get<ScriptResponse>(`${endpoint}/${id}`);

    // Extract backend data
    const backendData = response.data;

    const transformedData: Script = convertScriptResponse(backendData);
    
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
    const response = await backendServer.put<ScriptResponse>(`${endpoint}/${id}`, body);

    // Extract backend data
    const backendData = response.data;

    // Transform the backend data
    const transformedData: Script = convertScriptResponse(backendData);

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