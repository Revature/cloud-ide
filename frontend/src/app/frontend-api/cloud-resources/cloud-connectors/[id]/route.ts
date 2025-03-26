// src/app/api/v1/cloud-connectors/[id]/route.ts
import { NextResponse } from 'next/server';
import { BackendCloudConnector } from '@/types/api';
import { CloudConnector } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const id = params.id;

    // Fetch the cloud connector details
    const response = await fetch(`${apiUrl}/api/cloud_connectors/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch cloud connector with ID ${id}` },
        { status: response.status }
      );
    }

    const backendConnector: BackendCloudConnector = await response.json();
    
    // Transform backend cloud connector to frontend format
    const transformedConnector: CloudConnector = {
      id: backendConnector.id,
      name: backendConnector.name,
      type: backendConnector.provider_type,
      region: backendConnector.region,
      active: Boolean(backendConnector.active),
      image: `/images/providers/${backendConnector.provider_type.toLowerCase()}.svg`,
      createdOn: new Date(backendConnector.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      updatedOn: new Date(backendConnector.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      // Include additional details for single connector view
      // These fields might be masked in the list view
      accessKey: backendConnector.access_key,
      secretKey: backendConnector.secret_key,
    };

    return NextResponse.json(transformedConnector);
  } catch (error) {
    console.error('Cloud Connector API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cloud connector details' },
      { status: 500 }
    );
  }
}