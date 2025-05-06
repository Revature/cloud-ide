// app/logout/route.ts (or pages/api/logout.ts)
import { signOut } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation'; // For App Router
// For Pages Router: import { NextApiRequest, NextApiResponse } from 'next';


export async function GET() {
  await signOut(); // Clears the session
  redirect('/ui/'); // Redirect to homepage or login page after logout
;
}