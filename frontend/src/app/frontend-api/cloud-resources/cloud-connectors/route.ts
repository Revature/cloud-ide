import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector } from '@/types/cloudConnectors';
import { BackendCloudConnector } from '@/types/api';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

const endpoint = '/api/v1/cloud_connectors/';

export async function GET(request: NextRequest) {
  try {
    console.log(request);
    console.log(backendServer.defaults.baseURL);
    console.log(endpoint);
    
    const response = await backendServer.get<BackendCloudConnector[]>(endpoint);

    const backendData = response.data;

    const transformedData: CloudConnector[] = backendData.map((item: BackendCloudConnector) => ({
      id: item.id,
      provider: item.provider,
      name: `${item.provider} ${item.region}`,
      type: item.provider,
      region: item.region,
      status: item.status,
      accessKey: item.encrypted_access_key,
      secretKey: item.encrypted_secret_key,
      createdOn: new Date(item.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(item.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      image: `/images/brand/${item.provider.toLowerCase()}-logo.svg`,
      modifiedBy: item.modified_by,
      createdBy: item.created_by,
    }));

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

    const response = await backendServer.post<BackendCloudConnector>(endpoint, requestBody);

    const connector = response.data;

    const transformedConnector: CloudConnector = {
      id: connector.id,
      provider: connector.provider,
      name: `${connector.provider} ${connector.region}`,
      type: connector.provider,
      region: connector.region,
      status: connector.status,
      accessKey: connector.encrypted_access_key,
      secretKey: connector.encrypted_secret_key,
      createdOn: new Date(connector.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(connector.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      image: `/images/brand/${connector.provider.toLowerCase()}-logo.svg`,
      modifiedBy: connector.modified_by,
      createdBy: connector.created_by,
    };

    return NextResponse.json(transformedConnector);
  } catch (error) {
    
   return handleRouteError(error, { action: 'create cloud connector' });
  }
}