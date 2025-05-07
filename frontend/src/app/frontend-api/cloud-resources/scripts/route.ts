import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${apiUrl}/api/v1/scripts/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scripts. Status: ${response.status}`);
    }

    const data = await response.json();

    const transformedData: Script[] = 
        data.map((item: BackendScript) => ({
              id: item.id,
              name: item.name,
              imageId: item.image_id,
              description: item.description,
              script: item.script,
              event: item.event,
              createdAt: new Date(item.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short', 
                day: 'numeric'
              }),
              updatedAt: new Date(item.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }),
              createdBy: item.created_by,
              modifiedBy: item.modified_by,    
            }));

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scripts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    try {
      const body = await request.json();
  
      const response = await fetch(`${apiUrl}/api/v1/scripts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });
  
      if (!response.ok) {
        throw new Error(`Failed to create script. Status: ${response.status}`);
      }
  
      const createdData: BackendScript = await response.json();
  
      const transformedData: Script = {
        id: createdData.id,
        name: createdData.name,
        imageId: createdData.image_id,
        description: createdData.description,
        script: createdData.script,
        event: createdData.event,
        createdAt: new Date(createdData.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        updatedAt: new Date(createdData.updated_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        createdBy: createdData.created_by,
        modifiedBy: createdData.modified_by,
      };
  
      return NextResponse.json(transformedData);
    } catch (error) {
      console.error('Error creating script:', error);
      return NextResponse.json(
        { error: 'Failed to create script' },
        { status: 500 }
      );
    }
  }