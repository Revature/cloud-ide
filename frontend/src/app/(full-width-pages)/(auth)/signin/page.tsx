import { Metadata } from "next";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign In | TailAdmin",
  description: "Sign in to your account using WorkOS authentication.",
};

export default async function SignIn() {
  const signInUrl = await getSignInUrl(); // Generate the WorkOS sign-in URL
  redirect(signInUrl); // Redirect the user to the WorkOS sign-in page
}
