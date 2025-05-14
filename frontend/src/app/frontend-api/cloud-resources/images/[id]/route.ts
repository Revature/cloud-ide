import { NextRequest, NextResponse } from 'next/server';
import { convertImageResponse, Image } from '@/types/images';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


const endpoint = `/api/v1/images`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use backendServer to make the GET request
    const response = await backendServer.get(`${endpoint}/${id}`);
    console.log(request);

    const backendData = response.data;

    // Transform the backend data
    const transformedData: Image = convertImageResponse(backendData);

    console.log('Transformed data for frontend:', transformedData);

    return NextResponse.json(transformedData);
  } catch (error) {
   return handleRouteError(error, { id: (await params).id, action: 'fetch image' });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    const body = await request.json();

    // Use backendServer to make the PATCH request
    const response = await backendServer.patch(`${endpoint}/${id}/runner_pool`, { runner_pool_size: body.runner_pool_size });

    const responseData = response.data;

    return NextResponse.json(responseData);
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'update image' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(request);

    // Use backendServer to make the DELETE request
    await backendServer.delete(`${endpoint}/${id}`);

    return NextResponse.json({ message: `Image with ID ${id} deleted successfully.` });
  } catch (error) {
    return handleRouteError(error, { id: (await params).id, action: 'delete image' });
  }
}