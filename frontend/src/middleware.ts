// middleware.ts
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

const AUTH_MODE = process.env.AUTH_MODE === 'OFF' ? false : true;
const ORG_ID = process.env.WORKOS_ORG_ID || 'org_L0C4L';

const roleProtectedRoutes: Record<string, string[]> = {
  '/cloud-connectors': ['admin'],
  '/images': ['admin'],
  '/runner-pools': ['admin'],
  '/runners': ['admin', 'member'],
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

// Use server-side state to cache authentication information
// This reduces API calls for subsequent middleware executions
const authCache = new Map<string, {
  role: string;
  organizationId: string;
  timestamp: number;
}>();

// Cache TTL in milliseconds (2 minutes)
const CACHE_TTL = 2 * 60 * 1000;

// Custom function to get user role and organization
async function getUserAuth(request: NextRequest) {
  if (!AUTH_MODE) {
    return { role: 'member', organizationId: ORG_ID };
  }

  try {
    // Generate a cache key based on the request cookies
    // This ensures each user session gets its own cache entry
    const cookieHeader = request.headers.get('cookie') || '';
    const cacheKey = cookieHeader; // Using the entire cookie string as the cache key
    const now = Date.now();
    
    // Check for cached authentication
    const cachedAuth = authCache.get(cacheKey);
    if (cachedAuth && (now - cachedAuth.timestamp) < CACHE_TTL) {
      console.log('Using cached authentication');
      return { 
        role: cachedAuth.role, 
        organizationId: cachedAuth.organizationId 
      };
    }
    
    // Make a server-side request to our auth verification API
    const protocol = request.nextUrl.protocol;
    const host = request.headers.get('host') || 'localhost:3000';
    const verifyUrl = `${protocol}//${host}/ui/frontend-api/auth/verify`;
    
    console.log(`Making authentication verification request to ${verifyUrl}`);
    
    // Pass along all cookies to ensure authentication works
    const response = await fetch(verifyUrl, {
      headers: {
        cookie: cookieHeader,
      },
    });
    
    if (!response.ok) {
      console.log('Auth verification failed:', await response.text());
      return null;
    }
    
    const authData = await response.json();
    
    if (!authData.authenticated) {
      console.log('User not authenticated');
      return null;
    }
    
    // Get role and organization ID from the response
    const { role, organizationId } = authData;
    
    // Cache the result
    authCache.set(cacheKey, {
      role,
      organizationId,
      timestamp: now
    });
    
    return { role, organizationId };
  } catch (error) {
    console.error('Error getting user authentication:', error);
    return null;
  }
}

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

  // Use our custom function instead of withAuth()
  const user = await getUserAuth(request);
  
  if (!user) {
    console.log('No user information available');
    const loginRedirectUrl = new URL("/ui/home", request.url);
    return NextResponse.redirect(loginRedirectUrl);
  }

  const { role, organizationId } = user;
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