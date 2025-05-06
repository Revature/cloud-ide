import { handleAuth } from '@workos-inc/authkit-nextjs';

// Redirect the user to `/` after successful sign in
// The redirect can be customized: `handleAuth({ returnPathname: '/foo' })`

const baseUrl = process.env.NEXT_PUBLIC_DEPLOYMENT_URL || 'localhost:3000'; // Replace with your actual base URL
export const GET = handleAuth({returnPathname: `https://${baseUrl}/ui/cloud-connectors`});
