// frontend/src/frontend-api/api.ts
import { Image } from '@/types';
import { CloudConnector } from '@/types';
import { Machine } from '@/types';

// Base URL for API requests
const BASE_URL = '/frontend-api';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  return response.json() as Promise<T>;
}

// Images API
export const imagesApi = {
  getAll: async (): Promise<Image[]> => {
    const response = await fetch(`${BASE_URL}/images/`);
    return handleResponse<Image[]>(response);
  },
  
  getById: async (id: number): Promise<Image> => {
    const response = await fetch(`${BASE_URL}/images/${id}`);
    return handleResponse<Image>(response);
  },

};

export const cloudConnectorsApi = {
  getAll: async (): Promise<CloudConnector[]> => {
    const response = await fetch(`${BASE_URL}/cloud-connectors/`);
    const result = await handleResponse<{ data: CloudConnector[], meta: { total: number } }>(response);
    return result.data;
  },
  
  getById: async (id: number): Promise<CloudConnector> => {
    const response = await fetch(`${BASE_URL}/cloud-connectors/${id}`);
    return handleResponse<CloudConnector>(response);
  },
};

export const machinesApi = {
  getAll: async (): Promise<Machine[]> => {
    const response = await fetch(`${BASE_URL}/machines/`);
    const result = await handleResponse<{ data: Machine[], meta: { total: number } }>(response);
    return result.data;
  },
  
  getById: async (id: number): Promise<Machine> => {
    const response = await fetch(`${BASE_URL}/machines/${id}`);
    return handleResponse<Machine>(response);
  },

};

// Export a default object with all APIs
const api = {
  images: imagesApi,
  cloudConnectors: cloudConnectorsApi,
  machines: machinesApi,
};

export default api;