import { withAuth } from '@workos-inc/authkit-nextjs';
import axios from 'axios';

export const backendServer =  axios.create({
  baseURL: `https://${process.env['NEXT_PUBLIC_DEPLOYMENT_URL']}`,
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