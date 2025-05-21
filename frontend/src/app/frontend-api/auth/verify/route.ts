// pages/api/auth/verify.ts
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // This will work here because we're in an API route, not middleware
    const { role, organizationId } = await withAuth();
    // Return just the data we need for the middleware
    return NextResponse.json({
      authenticated: true,
      role: role || 'member',
      organizationId: organizationId || 'org_L0C4L',
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json({
      authenticated: false,
      error: 'Authentication failed',
    }, { status: 401 });
  }
}