import { NextRequest, NextResponse } from 'next/server';
import { backendServer } from '@/utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function POST(request: NextRequest) {
  try {
    const endpoint = '/api/v1/app_requests/with_status';

    // Parse the request body
    const body = await request.json();

    // Forward the request to the backend using backendServer
    const response = await backendServer.post(endpoint, body);

    const responseData = response.data;

    return NextResponse.json(responseData);
  } catch (error) {
    return handleRouteError(error, {action: 'fetching app requests for runenr'});
  }
}