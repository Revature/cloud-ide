import { NextRequest, NextResponse } from 'next/server';
import { BackendRunner } from '@/types/api';
import { Runner } from '@/types/runner';

export async function GET(request: NextRequest) {
  try {
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/runners/';

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

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Runners API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch runners', data: [] },
      { status: 500 }
    );
  }
}