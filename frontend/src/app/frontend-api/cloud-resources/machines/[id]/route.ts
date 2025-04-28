// src/app/frontend-api/cloud-resources/machines/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Machine, convertBackendMachine } from '@/types/machines';

export async function GET(
  request: NextRequest,
  { params } : { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/machines/${id}`;
    
    console.log(`Fetching individual machine from backend: ${apiUrl}${endpoint}`);

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }
    
    // Make the actual request to your backend
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
      } else {
        // If it's a direct object, use it directly
        backendData = parsedResponse;
      }
      
      console.log('Processed machine data:', backendData);
      
      // Validate that we have the expected fields
      if (!backendData || !backendData.id) {
        console.error('Invalid machine data:', backendData);
        throw new Error('Invalid machine data returned from backend');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error('Failed to parse backend response');
    }
    
    // Transform the backend data using the helper function
    const machine: Machine = convertBackendMachine(backendData);
    
    // For now, return just the machine data
    // In a future implementation, you could fetch related images here
    const machineWithImages = {
      ...machine,
      // If needed, add related data here
    };
    
    console.log('Transformed data for frontend:', machineWithImages);
    
    // Return the transformed data
    return NextResponse.json(machineWithImages);
  } catch (error) {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    console.error(`Error fetching machine with ID ${id}:`, error);
    
    return NextResponse.json(
      { error: `Failed to fetch machine with ID ${id}` },
      { status: 500 }
    );
  }
}