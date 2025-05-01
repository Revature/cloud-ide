import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {

    const response = await fetch(`${apiUrl}/api/v1/scripts/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': request.headers.get('Access-Token') || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch script with ID ${id}. Status: ${response.status}`);
    }

    const data:BackendScript = await response.json();
    const transformedData: Script = {
          id: data.id,
          name: data.name,
          imageId: data.image_id,
          description: data.description,
          script: data.script,
          createdAt: new Date(data.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          updatedAt: new Date(data.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          createdBy: data.created_by,
          modifiedBy: data.modified_by
        };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching script with ID ${id}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch script with ID ${id}` },
      { status: 500 }
    );
  }
}