// src/app/frontend-api/cloud-resources/images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VMImage } from '@/types/images';
import { BackendVMImage } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/images/';
    
    console.log(request);
    console.log(`Fetching images from backend: ${apiUrl}${endpoint}`);
    
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
    
    // Get the raw response text first to debug
    const responseText = await response.text();
    console.log('Raw backend response:', responseText);
    
    // Parse the response text
    let backendData;
    try {
      // Try to parse the response as JSON
      const parsedResponse = JSON.parse(responseText);
      
      // Check if the response has a data property (APIResponse format)
      if (parsedResponse.data) {
        backendData = parsedResponse.data;
      } else if (Array.isArray(parsedResponse)) {
        // If it's a direct array, use it directly
        backendData = parsedResponse;
      } else {
        // If it's some other structure, log it and use an empty array
        console.error('Unexpected response structure:', parsedResponse);
        backendData = [];
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      backendData = [];
    }
    
    console.log('Processed backend data:', backendData);
    
    // Transform the backend data using proper types
    const transformedData: VMImage[] = Array.isArray(backendData) 
      ? backendData.map((item: BackendVMImage) => ({
          id: item.id,
          name: item.name,
          identifier: item.identifier,
          description: item.description,
          // Convert to boolean if it's a number (1 or 0)
          active: typeof item.active === 'number' ? Boolean(item.active) : !!item.active,
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
          createdBy: item.created_by,
          modifiedBy: item.modified_by,
          
          // Only include IDs for related resources
          cloudConnectorId: item.cloud_connector_id,
          machineId: item.machine_id,
          runnerPoolSize: item.runner_pool_size
        }))
      : [];
    
    console.log('Transformed data for frontend:', transformedData);
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Images API error:', error);
    
    return NextResponse.json(
      [], // Return an empty array instead of an error object
      { status: 200 } // Return 200 status to avoid frontend errors
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/images/`;

    const body = await request.json();

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const responseData = await response.json();
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error creating image:', error);
    return NextResponse.json(
      { error: 'Failed to create image' },
      { status: 500 }
    );
  }
}