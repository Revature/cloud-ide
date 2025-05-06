// src/app/frontend-api/cloud-resources/images/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VMImage } from '@/types/images';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const endpoint = `/api/v1/images/${id}`;

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

    console.log(`Fetching individual image from backend: ${apiUrl}${endpoint}`);

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

    const responseText = await response.text();
    console.log('Raw backend response:', responseText);

    let imageData;
    try {
      const parsedResponse = JSON.parse(responseText);
      imageData = parsedResponse.data || parsedResponse;

      if (!imageData || !imageData.id) {
        console.error('Invalid image data:', imageData);
        throw new Error('Invalid image data returned from backend');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error('Failed to parse backend response');
    }

    const transformedData: VMImage = {
      id: imageData.id,
      name: imageData.name,
      identifier: imageData.identifier,
      description: imageData.description,
      active: typeof imageData.active === 'number' ? Boolean(imageData.active) : !!imageData.active,
      createdOn: new Date(imageData.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedOn: new Date(imageData.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: imageData.created_by,
      modifiedBy: imageData.modified_by,
      cloudConnectorId: imageData.cloud_connector_id,
      machineId: imageData.machine_id,
      runnerPoolSize: imageData.runner_pool_size,
    };

    console.log('Transformed data for frontend:', transformedData);

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const endpoint = `/api/v1/images/${id}/runner_pool`;

    const body = await request.json();

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

    if (typeof body.runner_pool_size !== 'number' || body.runner_pool_size < 0) { 
      return NextResponse.json(
        { error: 'Invalid runner_pool_size. It must be a positive number.' },
        { status: 400 }
      );
    }

    console.log(`Updating runner pool size for image ID ${id} to ${body.runner_pool_size}`);

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({ runner_pool_size: body.runner_pool_size }),
    });

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Runner pool size updated successfully:', responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    console.error(`Error updating runner pool size for image with ID ${id}:`, error);

    return NextResponse.json(
      { error: `Failed to update runner pool size for image with ID ${id}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const id = awaitedParams.id;

    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const endpoint = `/api/v1/images/${id}`;

    const accessToken = request.headers.get('Access-Token');
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access-Token is missing from the request headers.' },
        { status: 401 }
      );
    }

    console.log(`Deleting image with ID ${id} from backend: ${apiUrl}${endpoint}`);

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

    console.log(`Image with ID ${id} deleted successfully.`);
    return NextResponse.json({ message: `Image with ID ${id} deleted successfully.` });
  } catch (error) {
    const awaitedParams = await params;
    const id = awaitedParams.id;
    console.error(`Error deleting image with ID ${id}:`, error);

    return NextResponse.json(
      { error: `Failed to delete image with ID ${id}` },
      { status: 500 }
    );
  }
}