import { fetchAuthToken, resetAuthToken } from './fetchAuthToken'; // Import the token fetcher and reset logic

// Define the HTTP methods type
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Define the RequestOptions type properly
type RequestOptions<TBody = unknown> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
};

const BASE_URL = '/ui/frontend-api';

export async function apiRequest<TResponse, TBody = unknown>(
  endpoint: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const { method = 'GET', body, headers = {} } = options;

  // Fetch the Auth-Token dynamically
  const authToken = await fetchAuthToken() || "asdlfkajsdlfkj";

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Access-Token': authToken, // Add the Auth-Token to the headers
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
      resetAuthToken();
      return apiRequest(endpoint, options);
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}