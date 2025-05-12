// // middleware.ts
// import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// const AUTH_MODE = process.env.AUTH_MODE === 'OFF' ? false : true;

// export default authkitMiddleware({middlewareAuth:{
//   enabled: AUTH_MODE, 
//   unauthenticatedPaths: ['/frontend-api/auth/callback'], 
// },
// redirectUri: process.env['NEXT_PUBLIC_WORKOS_REDIRECT_URI'],
// });

// export const config = {
//   matcher: [
//     '/((?!_next/static|_next/image|favicon.ico).*)',
//   ],
// };

// middleware.ts
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

const AUTH_MODE = process.env.AUTH_MODE === 'OFF' ? false : true;

export default authkitMiddleware({
  middlewareAuth: {
    enabled: AUTH_MODE, 
    unauthenticatedPaths: [
      '/home',                            // Home page
      '/frontend-api/auth/callback'   // Auth callback
    ], 
  },
  redirectUri: process.env['NEXT_PUBLIC_WORKOS_REDIRECT_URI'],
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};