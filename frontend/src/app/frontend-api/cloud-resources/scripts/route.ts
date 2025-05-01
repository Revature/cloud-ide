import { BackendScript } from '@/types';
import { Script } from '@/types/scripts';
import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${apiUrl}/api/v1/scripts/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': request.headers.get('Access-Token') || '',
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