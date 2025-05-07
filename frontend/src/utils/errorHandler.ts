import { AxiosError } from 'axios';
import { NextResponse } from 'next/server';

interface ErrorResponse {
  error: string;
  details?: unknown;
}

export function handleRouteError(
  error: unknown,
  context: { id?: string; action?: string }
): NextResponse {
  console.error(
    `Error ${context.action ? `during ${context.action}` : ''}${
      context.id ? ` for ID ${context.id}` : ''
    }:`,
    error
  );

  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError; // Narrowing for Axios-specific errors
    return NextResponse.json(
      {
        error: `Failed ${context.action ? `to ${context.action}` : ''}${
          context.id ? ` for ID ${context.id}` : ''
        }`,
        details: axiosError.response?.data,
      } as ErrorResponse,
      { status: axiosError.response?.status || 500 }
    );
  }

  return NextResponse.json(
    {
      error: `Unexpected error occurred${
        context.action ? ` during ${context.action}` : ''
      }${context.id ? ` for ID ${context.id}` : ''}`,
      details: error,
    } as ErrorResponse,
    { status: 500 }
  );
}