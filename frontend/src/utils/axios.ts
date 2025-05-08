import { withAuth } from '@workos-inc/authkit-nextjs';
import axios from 'axios';

const deploymentUrl = process.env['NEXT_PUBLIC_DEPLOYMENT_URL'];
const protocol = deploymentUrl?.includes('localhost') ? 'http://' : 'https://';
console.log(`${protocol}${deploymentUrl}`);

export const backendServer =  axios.create({
  baseURL: `${protocol}${deploymentUrl}`,
    headers: {
        'Content-Type': 'application/json',
    },
});

backendServer.interceptors.request.use(async request => {
    const {accessToken} = await withAuth();
    if (accessToken) {
        request.headers['Access-Token'] = accessToken;
    }
    return request;
}, 
error => {
    console.error('Error in request interceptor:', error);
    return Promise.reject(error);
});

backendServer.interceptors.response.use(
    response => response, // Directly return successful responses.
    async error => {
      const originalRequest = error.config;
      if (error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true; // Mark the request as retried to avoid infinite loops.
        try {
          return backendServer(originalRequest); // Retry the original request with the new access token.
        } catch (error) {
          // Handle refresh token errors by clearing stored tokens and redirecting to the login page.
          console.error('Token refresh failed:', error);
          return Promise.reject(error);
        }
      }
      return Promise.reject(error); // For all other errors, return the error as is.
    }
  );