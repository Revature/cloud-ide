import { convertScriptResponse, Script, ScriptResponse } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


// Backend API endpoint
const endpoint = '/api/v1/scripts/';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Use backendServer to make the request
    const response = await backendServer.post<ScriptResponse>(endpoint, body);

    // Extract backend data
    const backendData = response.data;

    // Transform the backend data
    const transformedData: Script = convertScriptResponse(backendData);

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'create script' });
  }
}