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

  // Check if the error is an AxiosError
  if (error instanceof AxiosError) {
    return NextResponse.json(
      {
        error: `Failed ${context.action ? `to ${context.action}` : ''}${
          context.id ? ` for ID ${context.id}` : ''
        }`,
        details: error,
      } as ErrorResponse
    );
  }

  // Handle non-Axios errors
  return NextResponse.json(
    {
      error: `Unexpected error occurred${
        context.action ? ` during ${context.action}` : ''
      }${context.id ? ` for ID ${context.id}` : ''}`,
      details: error,
    } as ErrorResponse
  );
}