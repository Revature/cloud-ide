// src/app/frontend-api/cloud-resources/machines/route.ts
import { NextResponse } from 'next/server';
import { Machine, convertBackendMachine } from '@/types/machines';
import { BackendMachine, APIResponse } from '@/types/api';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET() {
  try {
    // Backend API endpoint
    const endpoint = '/api/v1/machines/';

    const response = await backendServer.get<APIResponse<BackendMachine[]>>(endpoint);

    const backendData = response.data.data || [];

    const transformedData: Machine[] = backendData.map(convertBackendMachine);

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetching machines' });
  }
}