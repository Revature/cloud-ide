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
          event: data.event,
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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    try {
      const body = await request.json();
  
      const response = await fetch(`${apiUrl}/api/v1/scripts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': request.headers.get('Access-Token') || '',
        },
        body,
      });
  
      if (!response.ok) {
        throw new Error(`Failed to update script with ID ${id}. Status: ${response.status}`);
      }
  
      const updatedData: BackendScript = await response.json();
      const transformedData: Script = {
        id: updatedData.id,
        name: updatedData.name,
        imageId: updatedData.image_id,
        description: updatedData.description,
        script: updatedData.script,
        event: updatedData.event,
        createdAt: new Date(updatedData.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        updatedAt: new Date(updatedData.updated_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        createdBy: updatedData.created_by,
        modifiedBy: updatedData.modified_by,
      };
  
      return NextResponse.json(transformedData);
    } catch (error) {
      console.error(`Error updating script with ID ${id}:`, error);
      return NextResponse.json(
        { error: `Failed to update script with ID ${id}` },
        { status: 500 }
      );
    }
  }

  export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    try {
      const response = await fetch(`${apiUrl}/api/v1/scripts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': request.headers.get('Access-Token') || '',
        },
      });
  
      if (!response.ok) {
        throw new Error(`Failed to delete script with ID ${id}. Status: ${response.status}`);
      }
  
      return NextResponse.json({
        success: true,
        message: `Script with ID ${id} has been successfully deleted.`,
      });
    } catch (error) {
      console.error(`Error deleting script with ID ${id}:`, error);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to delete script with ID ${id}.`,
        },
        { status: 500 }
      );
    }
  }