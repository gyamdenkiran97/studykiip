import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { safeRedirectPath } from "@/server/validation/common";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, actor] = await Promise.all([searchParams, getActor()]);
  // Open redirects are a phishing vector: only same-site paths are honoured.
  const destination = safeRedirectPath(next, "/account");
  if (actor) redirect(destination);

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your basket, orders and saved items follow you between devices."
      footer={
        <>
          New here? <AuthLink href={`/sign-up?next=${encodeURIComponent(destination)}`}>Create an account</AuthLink>
        </>
      }
    >
      <SignInForm next={destination} />
    </AuthShell>
  );
}
