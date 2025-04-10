import { NextRequest, NextResponse } from 'next/server';
import { Runner } from '@/types/runner';

export async function GET(
  request: NextRequest,
  { params } : { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/runners/${id}`;
    
    console.log(`Fetching individual runner from backend: ${apiUrl}${endpoint}`);
    
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
    
    // Transform the backend data using proper types
    const transformedData: Runner = {
            id: runnerData.id,
              userId: runnerData.user_id, // Optional because runners in the pool don't have a user yet
              imageId: runnerData.image_id,
              machineId: runnerData.machine_id,
              keyId: runnerData.key_id,
              state: runnerData.state,
              identifier: runnerData.identifier,
              externalHash: runnerData.external_hash,
              url: runnerData.url, // Will be populated when the runner is ready
              userIP: runnerData.user_ip,
              envData: runnerData.env_data,
              sessionStart: new Date(runnerData.session_start).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric',
                }), // When user requests runner
              sessionEnd: new Date(runnerData.session_end).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric',
                }), // When runner expires
              endedOn: new Date(runnerData.ended_on).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric',
                }),
              createdOn: new Date(runnerData.created_on).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }),
              updatedOn: new Date(runnerData.updated_on).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }),
              modifiedBy: runnerData.modified_by,
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