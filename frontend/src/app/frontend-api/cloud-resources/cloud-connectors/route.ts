// src/app/frontend-api/cloud-resources/cloud-connectors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector } from '@/types/cloudConnectors';
import { BackendCloudConnector } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/cloud_connectors/';

    console.log(request);
    console.log(`Fetching from backend: ${apiUrl}${endpoint}`);

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }
    
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const backendData = await response.json() as BackendCloudConnector[];
    console.log('Backend response:', backendData);
    
    const transformedData: CloudConnector[] = backendData.map((item: BackendCloudConnector) => ({
      id: item.id,
      provider: item.provider,
      name: `${item.provider} ${item.region}`,
      type: item.provider,
      region: item.region,
      active: true,
      accessKey: item.encrypted_access_key,
      secretKey: item.encrypted_secret_key,
      createdOn: new Date(item.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      updatedOn: new Date(item.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      image: `/images/brand/${item.provider.toLowerCase()}-logo.svg`,
      modifiedBy: item.modified_by,
      createdBy: item.created_by
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Cloud Connectors API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cloud connectors', data: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/cloud_connectors/';

    const body = await request.json();

    console.log(`Creating new cloud connector at ${apiUrl}${endpoint}`);
    console.log('Request body:', body);

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    if (responseData.success) {
      const connector: BackendCloudConnector = responseData.connector;
      console.log('Cloud connector created successfully:', connector);

      const transformedConnector: CloudConnector = {
        id: connector.id,
        provider: connector.provider,
        name: `${connector.provider} ${connector.region}`,
        type: connector.provider,
        region: connector.region,
        active: true,
        accessKey: connector.encrypted_access_key,
        secretKey: connector.encrypted_secret_key,
        createdOn: new Date(connector.created_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        updatedOn: new Date(connector.updated_on).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        image: `/images/brand/${connector.provider.toLowerCase()}-logo.svg`,
        modifiedBy: connector.modified_by,
        createdBy: connector.created_by
      };

      return NextResponse.json(transformedConnector);
    } else {
      console.error('Cloud connector creation failed:', responseData.message);
      console.error('Denied actions:', responseData.denied_actions);

      return NextResponse.json(
        { error: responseData.message, deniedActions: responseData.denied_actions },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating cloud connector:', error);
    return NextResponse.json(
      { error: 'Failed to create cloud connector' },
      { status: 500 }
    );
  }
}