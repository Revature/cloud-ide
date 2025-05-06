import Link from "next/link";
import { getSignInUrl, getSignUpUrl, withAuth } from "@workos-inc/authkit-nextjs";

export default async function LogoutPage() {
  const { user } = await withAuth();

  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            You are already logged in
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Logged in as <span className="font-medium">{user.email}</span>.
          </p>
          <div className="flex justify-between">
            <button
              onClick={async () => {
                await fetch('/frontend-api/auth/logout', { method: 'GET' });
                window.location.href = '/ui/'; // Redirect to the homepage after logout
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>
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