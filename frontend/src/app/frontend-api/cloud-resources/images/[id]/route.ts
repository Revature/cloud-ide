// src/app/frontend-api/cloud-resources/images/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VMImage } from '@/types/images';

export async function GET(
  request: NextRequest,
  { params } : { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/images/${id}`;
    
    console.log(`Fetching individual image from backend: ${apiUrl}${endpoint}`);
    
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
    let imageData;
    try {
      // Try to parse the response as JSON
      const parsedResponse = JSON.parse(responseText);
      
      // Check if the response has a data property (APIResponse format)
      if (parsedResponse.data) {
        imageData = parsedResponse.data;
      } else {
        // If it's a direct object, use it directly
        imageData = parsedResponse;
      }
      
      console.log('Processed image data:', imageData);
      
      // Validate that we have the expected fields
      if (!imageData || !imageData.id) {
        console.error('Invalid image data:', imageData);
        throw new Error('Invalid image data returned from backend');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error('Failed to parse backend response');
    }
    
    // Transform the backend data using proper types
    const transformedData: VMImage = {
      id: imageData.id,
      name: imageData.name,
      identifier: imageData.identifier,
      description: imageData.description,
      // Convert to boolean if it's a number (1 or 0)
      active: typeof imageData.active === 'number' ? Boolean(imageData.active) : !!imageData.active,
      createdOn: new Date(imageData.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      updatedOn: new Date(imageData.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      createdBy: imageData.created_by,
      modifiedBy: imageData.modified_by,
      
      // Only include IDs for related resources
      cloudConnector_id: imageData.cloud_connector_id,
      machine_id: imageData.machine_id
    };
    
    console.log('Transformed data for frontend:', transformedData);
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    console.error(`Error fetching image with ID ${id}:`, error);

    
    return NextResponse.json(
      { error: `Failed to fetch image with ID ${id}` },
      { status: 500 }
    );
  }
}