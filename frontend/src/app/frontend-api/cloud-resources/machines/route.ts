// src/app/frontend-api/cloud-resources/machines/route.ts
import { NextResponse } from 'next/server';
import { Machine, MachineResponse, convertMachineResponse } from '@/types/machines';
import { APIResponse } from '@/types/fe-api';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET() {
  try {
    // Backend API endpoint
    const endpoint = '/api/v1/machines/';

    const response = await backendServer.get<APIResponse<MachineResponse[]>>(endpoint);

    const backendData = response.data.data || [];

    const transformedData: Machine[] = backendData.map(convertMachineResponse);

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetching machines' });
  }
}