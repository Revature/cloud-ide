// src/app/api/v1/machines/route.ts
import { NextResponse } from 'next/server';
import { BackendMachine } from '@/types/api';
import { Machine } from '@/types';

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_API_URL || 'http://frontend:3500';
    const response = await fetch(`${apiUrl}/api/machines/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const backendMachines: BackendMachine[] = await response.json();
    
    // Transform backend machines to frontend format
    const transformedMachines = backendMachines.map((machine: BackendMachine): Machine => ({
      id: machine.id,
      name: machine.name,
      identifier: machine.identifier,
      cpu_count: machine.cpu_count,
      memory_size: machine.memory_size,
      storage_size: machine.storage_size,
      createdOn: new Date(machine.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      updatedOn: new Date(machine.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      // Add created_by and modified_by if available in the backend data
      createdBy: machine.created_by,
      modifiedBy: machine.modified_by,
    }));

    return NextResponse.json({
      data: transformedMachines,
      meta: {
        total: transformedMachines.length,
      }
    });
  } catch (error) {
    console.error('Machines API route error:', error);
    return NextResponse.json(
      { error: error || 'Failed to fetch machines', data: [] },
      { status: 500 }
    );
  }
}