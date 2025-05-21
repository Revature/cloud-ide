export interface APIResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Define the HTTP methods type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Define the RequestOptions type properly
export type RequestOptions<TBody = unknown> = {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
};