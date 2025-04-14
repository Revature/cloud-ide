import { NextRequest, NextResponse } from 'next/server';
import { Runner } from '@/types/runner';
import { BackendRunner } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params } : { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/runners/${id}`;
    
    console.log(`Fetching individual runner from backend: ${apiUrl}${endpoint}`);
    
    // Make the actual request to the backend
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': process.env.API_ACCESS_TOKEN || '',
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
    let runnerData;
    try {
      // Try to parse the response as JSON
      const parsedResponse = JSON.parse(responseText);
      
      // Check if the response has a data property (APIResponse format)
      if (parsedResponse.data) {
        runnerData = parsedResponse.data;
      } else {
        // If it's a direct object, use it directly
        runnerData = parsedResponse;
      }
      
      console.log('Processed runner data:', runnerData);
      
      // Validate that we have the expected fields
      if (!runnerData || !runnerData.id) {
        console.error('Invalid runner data:', runnerData);
        throw new Error('Invalid runner data returned from backend');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error('Failed to parse backend response');
    }

    // Get the backend data with proper typing
    const backendData = await response.json() as BackendRunner[];
    console.log('Backend response:', backendData);
    
    // Transform the backend data using proper types
        const transformedData: Runner[] = backendData.map((item: BackendRunner) => ({
          id: item.id,
            userId: item.user_id, // Optional because runners in the pool don't have a user yet
            imageId: item.image_id,
            machineId: item.machine_id,
            keyId: item.key_id,
            state: item.state,
            identifier: item.identifier,
            externalHash: item.external_hash,
            url: item.url, // Will be populated when the runner is ready
            userIP: item.user_ip,
            envData: item.env_data,
            sessionStart: new Date(item.session_start).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
              }), // When user requests runner
            sessionEnd: new Date(item.session_end).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
              }), // When runner expires
            endedOn: new Date(item.ended_on).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
              }),
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
            modifiedBy: item.modified_by,
        }));
    
    console.log('Transformed data for frontend:', transformedData);
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching runner with ID ${params.id}:`, error);
    
    return NextResponse.json(
      { error: `Failed to fetch runner with ID ${params.id}` },
      { status: 500 }
    );
  }
}