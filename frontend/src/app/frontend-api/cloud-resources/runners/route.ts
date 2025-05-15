import { NextResponse } from 'next/server';
import { convertRunnerResponse, Runner, RunnerResponse } from '@/types/runner';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';

export async function GET() {
  try {
    // Backend API endpoint
    const endpoint = '/api/v1/runners/';

    // Use backendServer to make the request
    const response = await backendServer.get<RunnerResponse[]>(endpoint);

    // Extract backend data
    const backendData = response.data;

    // Transform the backend data using proper types
    const transformedData: Runner[] = backendData.map(convertRunnerResponse);
    
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetching runners' });
  }
}