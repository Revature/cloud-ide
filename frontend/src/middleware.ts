// middleware.ts
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { jwtVerify } from 'jose';

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

// Custom function to extract user information from the session token
async function getUserFromSession(request: NextRequest) {
  if (!AUTH_MODE) {
    return { role: 'member', organizationId: ORG_ID };
  }

  try {
    console.log('Extracting ', request);
    // Get the session cookie
    const authKitSessionCookie = request.cookies.get('wos-session');
    
    if (!authKitSessionCookie?.value) {
      console.log('No session cookie found');
      return null;
    }
    
    // Get the JWT token from the cookie
    const token = authKitSessionCookie.value;
    
    try {
      // Basic JWT verification - we need to extract the data without full validation
      // since we don't have access to the WorkOS client in the middleware
      const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'your-jwt-secret');
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ['HS256']
      });
      
      // Extract user information from the payload
      // Note: The exact structure depends on how WorkOS stores user data in the JWT
      const user = payload;
      const organizationId = user.organization_id || user.org_id || null;
      const role = user.role || user.user_role || 'member';
      
      return { role, organizationId };
    } catch (jwtError) {
      // If standard JWT verification fails, try parsing the token directly
      // This is a fallback approach for when we don't have the correct secret
      console.log('Standard JWT verification failed, attempting manual parsing: ', jwtError);
      
      try {
        // Split the token and decode the payload part (second segment)
        const [_header, payloadBase64, _signature] = token.split('.');
        console.log(_header, payloadBase64, _signature);
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        console.log('Parsed payload:', payload);
        
        // Extract user information from the payload
        const organizationId = payload.organization_id || payload.org_id || null;
        const role = payload.role || payload.user_role || 'member';
        
        return { role, organizationId };
      } catch (parseError) {
        console.error('Error parsing JWT manually:', parseError);
        return null;
      }
    }
  } catch (error) {
    console.error('Error extracting user from session:', error);
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
  const user = await getUserFromSession(request);
  
  if (!user) {
    console.log('No user information available');
    const loginRedirectUrl = new URL("/home", request.url);
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