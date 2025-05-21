// middleware.ts
import { authkitMiddleware, withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

const AUTH_MODE = process.env.AUTH_MODE === 'OFF' ? false : true;
const ORG_ID =  process.env.WORKOS_ORG_ID || 'org_L0C4L';

const roleProtectedRoutes: Record<string, string[]> = {
  '/cloud-connectors': ['admin'], 
  '/images': ['admin'], 
  '/runner-pools': ['admin'],
  '/ui/runners': ['admin', 'member'], 
};

const baseAuthMiddleware = authkitMiddleware({
  middlewareAuth: {
    enabled: AUTH_MODE,
    unauthenticatedPaths: [
      '/home',
      '/frontend-api/auth/callback',
    ],
  },
  redirectUri: process.env['NEXT_PUBLIC_WORKOS_REDIRECT_URI'], 
});

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  const authResponse = await baseAuthMiddleware(request, event);

  if (authResponse && authResponse.headers.has('location')) {
    console.log('location header present:', authResponse.headers.get('location'));
    if (new URL(authResponse.headers.get('location')!, request.url).pathname !== pathname) {
      return authResponse;
    }
  }

  const requiredRolesForRoute = Object.entries(roleProtectedRoutes).find(
    ([routePrefix]) => pathname.startsWith(routePrefix) 
  )?.[1];
  console.log('Required roles for route:', requiredRolesForRoute);

  if (!requiredRolesForRoute) {
    console.log(`No role protection for ${pathname}.`);
    return authResponse || NextResponse.next();
  }

  const { role, organizationId } = AUTH_MODE ? await withAuth() : { role: 'member', organizationId: ORG_ID }; 
  console.log('User role:', role);
  console.log('User organization ID:', organizationId);

  if (organizationId !== ORG_ID) {
    console.log(`Unauthorized access attempt to ${pathname}. Invalid organization ID: ${organizationId}`);
    // Redirect to the new unauthorized page (ensure this is not protected by middleware)
    const unauthorizedRedirectUrl = new URL("/ui/runners", request.url);
    return NextResponse.redirect(unauthorizedRedirectUrl);
  }
 
  const hasRequiredRole = requiredRolesForRoute.some(requiredRole => role === requiredRole);
  console.log(`User role: ${role}, Required roles: [${requiredRolesForRoute.join(', ')}], Has required role: ${hasRequiredRole}`);

  if (!hasRequiredRole) {
    console.log(`Unauthorized access attempt to ${pathname}. User roles: ${role}, Required roles: [${requiredRolesForRoute.join(', ')}]`);
    // Redirect to the new unauthorized page (ensure this is not protected by middleware)
    const unauthorizedRedirectUrl = new URL("/ui/runners", request.url);
    return NextResponse.redirect(unauthorizedRedirectUrl);
  }
  
  return authResponse || NextResponse.next();
  
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/.*\\.[a-zA-Z0-9]+).*)',
  ],
};