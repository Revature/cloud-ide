// frontend/src/services/api.ts
import axios from 'axios';

// Create an axios instance
const api = axios.create({
  baseURL: '/api', // This points to your Next.js API routes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add any global interceptors if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Images API
export const imagesApi = {
  getAll: async () => {
    const { data } = await api.get('/images');
    return data;
  },
  
  getById: async (id: number) => {
    const { data } = await api.get(`/images/${id}`);
    return data;
  },
  
  create: async (imageData: any) => {
    const { data } = await api.post('/images', imageData);
    return data;
  },
  
  update: async (id: number, imageData: any) => {
    const { data } = await api.put(`/images/${id}`, imageData);
    return data;
  },
  
  delete: async (id: number) => {
    const { data } = await api.delete(`/images/${id}`);
    return data;
  },
  
  toggleStatus: async (id: number, active: boolean) => {
    const { data } = await api.put(`/images/${id}`, { active });
    return data;
  },
};

export default api;