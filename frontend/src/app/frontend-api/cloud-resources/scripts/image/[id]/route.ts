import { convertScriptResponse, Script, ScriptResponse } from '@/types/scripts';
import {  NextResponse } from 'next/server';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: imageId } = await params;

  try {
    // Backend API endpoint
    const endpoint = `/api/v1/scripts/image/${imageId}`;
    console.log(request);

    // Use backendServer to make the request
    const response = await backendServer.get<ScriptResponse[]>(endpoint);

    // Extract backend data
    const data = response.data;

    // Transform the backend data
    const transformedData: Script[] = data.map(convertScriptResponse);

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { id: imageId, action: 'fetch scripts' });
  }
}