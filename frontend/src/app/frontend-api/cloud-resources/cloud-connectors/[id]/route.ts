// src/app/frontend-api/cloud-resources/cloud-connectors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CloudConnector } from '@/types/cloudConnectors';
import { BackendCloudConnector } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params } : { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const endpoint = `/api/v1/cloud_connectors/${id}`;

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }
    
    console.log(`Fetching individual cloud connector from backend: ${apiUrl}${endpoint}`);
    
    // Make the actual request to your backend
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    // Get the backend data with proper typing
    const backendData = await response.json() as BackendCloudConnector;
    console.log('Backend response for single connector:', backendData);
    
    // Transform the backend data using proper types
    const transformedData: CloudConnector = {
      id: backendData.id,
      provider: backendData.provider,
      name: `${backendData.provider} ${backendData.region}`, // Generated name
      type: backendData.provider,
      region: backendData.region,
      active: true, // Default to active
      accessKey: backendData.encrypted_access_key,
      secretKey: backendData.encrypted_secret_key,
      createdOn: new Date(backendData.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      updatedOn: new Date(backendData.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      image: `/images/brand/${backendData.provider.toLowerCase()}-logo.svg`,
      modifiedBy: backendData.modified_by,
      createdBy: backendData.created_by
    };
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    console.error(`Error fetching cloud connector with ID ${id}:`, error);
    
    return NextResponse.json(
      { error: `Failed to fetch cloud connector with ID ${id}` },
      { status: 500 }
    );
  }
}