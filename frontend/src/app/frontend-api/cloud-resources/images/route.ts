// src/api/images/route.ts
import { NextResponse } from 'next/server';
import { BackendImage } from '@/types/api';
import { Image } from '@/types';

export async function GET() {
  try {
    const backendApiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const response = await fetch(`${backendApiUrl}/api/v1/images/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const backendImages: BackendImage[] = await response.json();
    
    // Transform backend images to frontend format
    const transformedImages = backendImages.map((image: BackendImage): Image => ({
      id: image.id,
      name: image.name,
      description: image.description,
      identifier: image.identifier,
      // We'll fetch full machine and cloud connector data separately
      // or include placeholders for now
      active: Boolean(image.active),
      createdOn: new Date(image.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      updatedOn: new Date(image.updated_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
    }));

    return NextResponse.json({
      data: transformedImages,
      meta: {
        total: transformedImages.length,
      }
    });
  } catch (error) {
    console.error('Images API route error:', error);
    return NextResponse.json(
      { error: error || 'Failed to fetch images', data: [] },
      { status: 500 }
    );
  }
}