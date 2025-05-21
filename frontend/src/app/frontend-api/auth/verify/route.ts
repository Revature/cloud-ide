// pages/api/auth/verify.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  try {
    // This will work here because we're in an API route, not middleware
    const { role, organizationId } = await withAuth();
    console.log(req);
    
    // Return just the data we need for the middleware
    res.status(200).json({
      authenticated: true,
      role: role || 'member',
      organizationId: organizationId || 'org_L0C4L'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      authenticated: false,
      error: 'Authentication failed'
    });
  }
}