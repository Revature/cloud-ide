import { backendServer } from "@/utils/axios";
import { handleRouteError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params;
  
      // Parse the request body to get the status payload
      const body = await request.json();
  
      // Forward the PUT request to the backend API
      const endpoint = `/api/v1/cloud_connectors/${id}/toggle`;
      const response = await backendServer.patch(endpoint, body);
  
      // Return the updated data from the backend
      return NextResponse.json(response.data);
    } catch (error) {
      return handleRouteError(error, { id: (await params).id, action: 'toggle cloud connector status' });
    }
  }