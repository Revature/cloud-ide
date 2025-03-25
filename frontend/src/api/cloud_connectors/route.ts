// src/app/api/v1/cloud-connectors/route.ts
import { NextResponse } from 'next/server';
import { BackendCloudConnector } from '@/types/api';
import { CloudConnector } from '@/types';

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_API_URL || 'http://frontend:3500';
    const response = await fetch(`${apiUrl}/api/cloud-connectors/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const backendConnectors: BackendCloudConnector[] = await response.json();
    
    // Transform backend cloud connectors to frontend format
    const transformedConnectors = backendConnectors.map((connector: BackendCloudConnector): CloudConnector => ({
      id: connector.id,
      name: connector.name,
      type: connector.provider_type,
      region: connector.region,
      active: Boolean(connector.active),
      image: `/images/providers/${connector.provider_type.toLowerCase()}.svg`,
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
    }));

    return NextResponse.json({
      data: transformedConnectors,
      meta: {
        total: transformedConnectors.length,
      }
    });
  } catch (error) {
    console.error('Cloud Connectors API route error:', error);
    return NextResponse.json(
      { error: error || 'Failed to fetch cloud connectors', data: [] },
      { status: 500 }
    );
  }
}