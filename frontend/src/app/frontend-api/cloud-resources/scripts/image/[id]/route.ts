import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: imageId } = await params;

  try {
    const response = await fetch(`${apiUrl}/api/v1/scripts/image/${imageId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scripts for image ID ${imageId}. Status: ${response.status}`);
    }

    const data: BackendScript[] = await response.json();

    const transformedData: Script[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      imageId: item.image_id,
      description: item.description,
      script: item.script,
      event: item.event,
      createdAt: new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(item.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: item.created_by,
      modifiedBy: item.modified_by,
    }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching scripts for image ID ${imageId}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch scripts for image ID ${imageId}` },
      { status: 500 }
    );
  }
}