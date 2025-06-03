import { NextRequest, NextResponse } from 'next/server';
import { convertRunnerResponse, Runner, RunnerResponse } from '@/types/runner';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


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
    const response = await backendServer.get<RunnerResponse>(`${endpoint}/${id}`);

    // Extract backend data
    const runnerData = response.data;

    // Validate that we have the expected fields
    if (!runnerData || !runnerData.id) {
      console.error('Invalid runner data:', runnerData);
      throw new Error('Invalid runner data returned from backend');
    }

    const runner : Runner = convertRunnerResponse(runnerData);

    return NextResponse.json(runner);
  } catch (error) {
    return handleRouteError(error, {action: 'fetching runner', id: (await params).id});
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const action = request.nextUrl.searchParams.get('action');
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