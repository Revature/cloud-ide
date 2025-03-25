// frontend/app/api/images/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // In production, you'd validate authentication here
    
    // Call your backend API
    const response = await fetch(`${process.env.API_URL || 'http://backend:8000'}/api/images/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform data to match your frontend needs
    const transformedData = data.map((image: any) => ({
      id: image.id,
      name: image.name,
      description: image.description,
      identifier: image.identifier,
      machineType: image.machine_id, // You'll map this to your machine types
      active: Boolean(image.active),
      createdAt: new Date(image.created_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      }),
      updatedAt: new Date(image.modified_on).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      // Add any other transformations needed
    }));

    return NextResponse.json(transformedData);
  } catch (error: any) {
    console.error('Images API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

// export async function POST(request: Request) {
//   try {
//     const imageData = await request.json();
    
//     // Transform data for backend
//     const backendData = {
//       name: imageData.name,
//       description: imageData.description,
//       identifier: imageData.identifier || generateRandomId(),
//       machine_id: imageData.machineId,
//       active: imageData.active,
//       // Add other necessary fields
//     };

//     const response = await fetch(`${process.env.API_URL || 'http://backend:8000'}/api/images/`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Access-Token': process.env.API_TOKEN || 'development-token',
//       },
//       body: JSON.stringify(backendData),
//     });

//     if (!response.ok) {
//       throw new Error(`API error: ${response.status}`);
//     }

//     const data = await response.json();
    
//     // Transform response data
//     const transformedData = {
//       id: data.id,
//       name: data.name,
//       description: data.description,
//       identifier: data.identifier,
//       // Transform other fields as needed
//     };

//     return NextResponse.json(transformedData);
//   } catch (error: any) {
//     console.error('Images API POST error:', error);
//     return NextResponse.json(
//       { error: error.message || 'Failed to create image' },
//       { status: 500 }
//     );
//   }
// }

// // Helper function to generate random ID (only used if backend doesn't provide one)
// function generateRandomId() {
//   return 'img_' + Math.random().toString(36).substring(2, 12);
// }