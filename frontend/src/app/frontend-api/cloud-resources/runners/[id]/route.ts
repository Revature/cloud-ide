import { NextRequest, NextResponse } from 'next/server';
import { Runner } from '@/types/runner';
import { BackendRunner } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  try {
    const id = awaitedParams.id;

    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/runners/${id}`;

    console.log(`Fetching individual runner from backend: ${apiUrl}${endpoint}`);

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

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

// Parse the JSON response
    const runnerData = await response.json// Validate that we have the expected fields
() as BackendRunner;

// Validate that we have the expected fields
    if (!runnerData || !runnerData.id) {
      console.error('Invalid runner data:', runnerData);
      throw new Error('Invalid runner data returned from backend');
    }

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

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching runner with ID ${awaitedParams.id}:`, error);

    return NextResponse.json(
      { error: `Failed to fetch runner with ID ${awaitedParams.id}` },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const id = awaitedParams.id;

  try {
    const body = await request.json();
    const action = body.action; // Expecting "start" or "stop"

    if (!['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop".' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/runners/${id}/${action}`;

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

    console.log(`Performing ${action} action on runner ${id}: ${apiUrl}${endpoint}`);

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    return NextResponse.json({ message: `Runner ${id} ${action}ed successfully.` });
  } catch (error) {
    console.error(`Error performing action on runner ${id}:`, error);

    return NextResponse.json(
      { error: `Failed to perform action on runner ${id}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const id = awaitedParams.id;

  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = `/api/v1/runners/${id}`;

    console.log(`Terminating runner ${id}: ${apiUrl}${endpoint}`);

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    return NextResponse.json({ message: `Runner ${id} terminated successfully.` });
  } catch (error) {
    console.error(`Error terminating runner ${id}:`, error);

    return NextResponse.json(
      { error: `Failed to terminate runner ${id}` },
      { status: 500 }
    );
  }
}