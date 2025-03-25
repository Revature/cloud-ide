// src/app/api/v1/machines/[id]/route.ts
import { NextResponse } from 'next/server';
import { BackendMachine } from '@/types/api';
import { Machine } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiUrl = process.env.NEXT_API_URL || 'http://frontend:3500';
    const id = params.id;
    
    // Fetch the machine details
    const response = await fetch(`${apiUrl}/api/machines/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch machine with ID ${id}` },
        { status: response.status }
      );
    }

    const backendMachine: BackendMachine = await response.json();
    
    // Transform backend machine to frontend format
    const transformedMachine: Machine = {
      id: backendMachine.id,
      name: backendMachine.name,
      identifier: backendMachine.identifier,
      cpu_count: backendMachine.cpu_count,
      memory_size: backendMachine.memory_size,
      storage_size: backendMachine.storage_size,
      createdOn: new Date(backendMachine.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      updatedOn: new Date(backendMachine.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      // Add created_by and modified_by if available in the backend data
      createdBy: backendMachine.created_by,
      modifiedBy: backendMachine.modified_by,
    };

    return NextResponse.json(transformedMachine);
  } catch (error) {
    console.error('Machine API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch machine details' },
      { status: 500 }
    );
  }
}