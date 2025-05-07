import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:8000' || 'http://backend:8000';
    const endpoint = '/api/v1/app_requests/with_status';

    // Parse the request body
    const body = await request.json();

    console.log(`Creating new app request at ${apiUrl}${endpoint}`);
    console.log('Request body:', body);

    // Forward the request to the backend
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`);
      console.error('Backend response:', responseData);
      throw new Error(`Backend API error: ${response.status}`);
    }

    console.log('App request created successfully:', responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error creating app request:', error);
    return NextResponse.json(
      { error: 'Failed to create app request' },
      { status: 500 }
    );
  }
}