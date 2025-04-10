// src/app/frontend-api/cloud-resources/cloud-connectors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector } from '@/types/cloudConnectors';
import { BackendCloudConnector } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/cloud_connectors/';

    console.log(request);
    console.log(`Fetching from backend: ${apiUrl}${endpoint}`);
    
    // Make the actual request to your backend
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    // Get the backend data with proper typing
    const backendData = await response.json() as BackendCloudConnector[];
    console.log('Backend response:', backendData);
    
    // Transform the backend data using proper types
    const transformedData: CloudConnector[] = backendData.map((item: BackendCloudConnector) => ({
      id: item.id,
      provider: item.provider,
      name: `${item.provider} ${item.region}`, // Generated name
      type: item.provider,
      region: item.region,
      active: true, // Default to active
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

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Cloud Connectors API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cloud connectors', data: [] },
      { status: 500 }
    );
  }
}