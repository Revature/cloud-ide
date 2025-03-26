// // src/app/frontend-api/cloud-resources/cloud-connectors/route.ts
// import { NextResponse } from 'next/server';

// const BACKEND_URL = process.env.BACKEND_API_URL || 'http://backend:8000';

// export async function GET() {
//   try {
//     // Call your backend API
//     const response = await fetch(`${BACKEND_URL}/api/v1/cloud_connectors/`, {
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     if (!response.ok) {
//       throw new Error(`API error: ${response.status}`);
//     }

//     const data = await response.json();
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Cloud Connectors API error:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch cloud connectors', data: [] },
//       { status: 500 }
//     );
//   }
// }

// src/app/frontend-api/cloud-resources/cloud-connectors/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // For testing, add mock data that will always return
    const mockData = [
      {
        id: 1,
        name: "AWS US East",
        type: "aws",
        region: "us-east-1",
        active: true,
        createdOn: "Mar 15, 2023"
      }
    ];

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error in cloud-connectors API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cloud connectors' },
      { status: 500 }
    );
  }
}