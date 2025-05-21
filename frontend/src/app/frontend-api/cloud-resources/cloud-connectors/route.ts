import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector, CloudConnectorResponse, convertCloudConnectorResponse } from '@/types/cloudConnectors';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

const endpoint = '/api/v1/cloud_connectors/';

export async function GET() {
  try {
    const response = await backendServer.get<CloudConnectorResponse[]>(endpoint);

    const backendData = response.data;

    const transformedData: CloudConnector[] = backendData.map(convertCloudConnectorResponse);

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching cloud connector:', error);
    if (typeof error === 'object' && error !== null) {
      for (const key in error) {
        console.error(`${key}: ${(error as Record<string, unknown>)[key]}`);
      }
    }

    return handleRouteError(error, { action: 'fetch cloud connectors' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();

    const response = await backendServer.post<CloudConnectorResponse>(endpoint, requestBody);

    const backendData = response.data;

    const transformedConnector: CloudConnector = convertCloudConnectorResponse(backendData);

    return NextResponse.json(transformedConnector);
  } catch (error) {
    
   return handleRouteError(error, { action: 'create cloud connector' });
  }
}