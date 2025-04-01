// src/app/frontend-api/cloud-resources/machines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Machine, convertBackendMachine } from '@/types/machines';
import { BackendMachine, APIResponse } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    // Backend API URL
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const endpoint = '/api/v1/machines/';
    
    console.log(request);
    console.log(`Fetching machines from backend: ${apiUrl}${endpoint}`);
    
    // Make the actual request to your backend
    const response = await fetch(`${apiUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    // Get the backend data with proper typing
    const apiResponse = await response.json() as APIResponse<BackendMachine[]>;
    const backendData = apiResponse.data || [];
    console.log('Backend response:', backendData);
    
    // Transform the backend data using the helper function
    const transformedData: Machine[] = backendData.map(convertBackendMachine);
    
    // Return the transformed data
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Machines API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch machines', data: [] },
      { status: 500 }
    );
  }
}