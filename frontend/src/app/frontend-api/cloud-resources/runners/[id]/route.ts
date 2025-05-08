import { NextRequest, NextResponse } from 'next/server';
import { Runner } from '@/types/runner';
import { BackendRunner } from '@/types/api';
import { backendServer } from '../../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';


// Backend API endpoint
const endpoint = `/api/v1/runners`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(request);

    // Use backendServer to make the request
    const response = await backendServer.get<BackendRunner>(`${endpoint}/${id}`);

    // Extract backend data
    const runnerData = response.data;

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
      sessionStart: new Date(runnerData.session_start).toLocaleString('en-US'),
      sessionEnd: new Date(runnerData.session_end).toLocaleString('en-US'),
      endedOn: new Date(runnerData.ended_on).toLocaleString('en-US'),
      createdOn: new Date(runnerData.created_on).toLocaleDateString('en-US'),
      updatedOn: new Date(runnerData.updated_on).toLocaleDateString('en-US'),
      modifiedBy: runnerData.modified_by,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, {action: 'fetching runner', id: (await params).id});
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, action: string }> }
) {
  try {
    const { id, action } = await params;
    console.log(request);

    // Validate the action
    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid or missing action. Must be "start" or "stop".' },
        { status: 400 }
      );
    }

    // Use backendServer to make the request
    await backendServer.patch(`${endpoint}/${id}/${action}`);

    return NextResponse.json({ message: `Runner ${id} ${action}ed successfully.` });
  } catch (error) {
    return handleRouteError(error, {action: 'update runner', id: (await params).id});
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(request);

    // Use backendServer to make the request
    await backendServer.delete(`${endpoint}/${id}`);

    return NextResponse.json({ message: `Runner ${id} terminated successfully.` });
  } catch (error) {
    return handleRouteError(error, {action: 'delete runner', id: (await params).id});
  }
}