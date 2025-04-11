// src/services/base.ts

// Define the HTTP methods type
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Define the RequestOptions type properly
type RequestOptions<TBody = unknown> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
}

const BASE_URL = '/ui/frontend-api';

export async function apiRequest<TResponse, TBody = unknown>(
  endpoint: string, 
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const { method = 'GET', body, headers = {} } = options;
  
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Access-Token': "dsadsnfsdkjfnsdkjfnskjdfn",
    ...headers,
  };
  
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  
  const response = await fetch(`${BASE_URL}${endpoint}`, requestOptions);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}