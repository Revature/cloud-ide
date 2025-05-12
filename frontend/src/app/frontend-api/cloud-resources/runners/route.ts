import { NextResponse } from 'next/server';
import { BackendRunner } from '@/types/api';
import { Runner } from '@/types/runner';
import { backendServer } from '../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET() {
  try {
    // Backend API endpoint
    const endpoint = '/api/v1/runners/';

    // Use backendServer to make the request
    const response = await backendServer.get<BackendRunner[]>(endpoint);

    // Extract backend data
    const backendData = response.data;

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
      sessionStart: item.session_start
        ? new Date(item.session_start).toLocaleString('en-US')
        : undefined, // When user requests runner
      sessionEnd: item.session_end
        ? new Date(item.session_end).toLocaleString('en-US')
        : undefined, // When runner expires
      endedOn: item.ended_on
        ? new Date(item.ended_on).toLocaleString('en-US')
        : undefined,
      createdOn: new Date(item.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(item.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      modifiedBy: item.modified_by,
    }));

    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetching runners' });
  }
}