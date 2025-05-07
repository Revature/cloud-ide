import Link from "next/link";
import { getSignInUrl, getSignUpUrl, signOut, withAuth } from "@workos-inc/authkit-nextjs";

export default async function HomePage() {
  const { user } = await withAuth();

  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <form action={async () => {
            'use server';
            await signOut();
          }}>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Welcome Back, <span className="font-medium">{user.firstName}</span>!
          </p>
          <div className="flex justify-between">
            <button
              type="submit"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  }

  const signInUrl = await getSignInUrl();
  const signUpUrl = await getSignUpUrl();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          Welcome to Revature Cloud IDE
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Please sign in or sign up to continue.
        </p>
        <div className="flex justify-between">
          <Link
            href={signInUrl}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            Login
          </Link>
          <Link
            href={signUpUrl}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}