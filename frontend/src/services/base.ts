import { RequestOptions } from "@/types/fe-api";

const BASE_URL = '/ui/frontend-api';

export async function apiRequest<TResponse, TBody = unknown>(
  endpoint: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, requestOptions);

  if (!response.ok) {
    if (response.status === 401) {
      // Reset the token if unauthorized and retry the request
      return apiRequest(endpoint, options);
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}