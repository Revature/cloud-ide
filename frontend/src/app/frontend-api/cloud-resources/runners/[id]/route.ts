import { NextRequest, NextResponse } from 'next/server';
import { Runner } from '@/types/runner';
import { BackendRunner } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params } : { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  try {
    const id = awaitedParams.id;
    
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

    // Parse the JSON response
    const runnerData = await response.json() as BackendRunner;
    
    // Validate that we have the expected fields
    if (!runnerData || !runnerData.id) {
      console.error('Invalid runner data:', runnerData);
      throw new Error('Invalid runner data returned from backend');
    }
    
    // Transform the backend data to our frontend model
    const transformedData: Runner = {
        id: runnerData.id,
        userId: runnerData.user_id,
        imageId: runnerData.image_id,
        machineId: runnerData.machine_id,
        keyId: runnerData.key_id,
        state: runnerData.state,
        identifier: runnerData.identifier,
        externalHash: runnerData.external_hash,
        url: runnerData.url,
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
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching runner with ID ${awaitedParams.id}:`, error);
    
    return NextResponse.json(
      { error: `Failed to fetch runner with ID ${awaitedParams.id}` },
      { status: 500 }
    );
  }
}