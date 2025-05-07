import { NextResponse } from 'next/server';
import { Machine, convertBackendMachine } from '@/types/machines';
import { backendServer } from '../../../../../utils/axios';
import { handleRouteError } from '@/utils/errorHandler';

export async function GET(
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Backend API endpoint
    const endpoint = `/api/v1/machines/${id}`;

    // Use backendServer to make the request
    const response = await backendServer.get(endpoint);

    // Extract backend data
    const backendData = response.data;

    // Validate that we have the expected fields
    if (!backendData || !backendData.id) {
      console.error('Invalid machine data:', backendData);
      throw new Error('Invalid machine data returned from backend');
    }

    // Transform the backend data using the helper function
    const machine: Machine = convertBackendMachine(backendData);

    // For now, return just the machine data
    const machineWithImages = {
      ...machine,
      // If needed, add related data here
    };

    // Return the transformed data
    return NextResponse.json(machineWithImages);
  } catch (error) {
    return handleRouteError(error, {action: 'fetching machine', id: (await params).id});
  }
}