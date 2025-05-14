// src/app/frontend-api/cloud-resources/images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { convertImageResponse, Image, ImageResponse } from '@/types/images';
import { handleRouteError } from '@/utils/errorHandler';
import { backendServer } from '@/utils/axios';


const endpoint = '/api/v1/images/';

export async function GET() {
  try {

    const response = await backendServer.get<ImageResponse[]>(endpoint);

    const backendData = response.data;

    const transformedData: Image[] = backendData.map(convertImageResponse);

    return NextResponse.json(transformedData);
  } catch (error) {
    return handleRouteError(error, { action: 'fetch images' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await backendServer.post(endpoint, body);

    const responseData = response.data;

    return NextResponse.json(responseData);
  } catch (error) {
    return handleRouteError(error, { action: 'create image' });
  }
}