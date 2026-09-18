import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { safeRedirectPath } from "@/server/validation/common";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, actor] = await Promise.all([searchParams, getActor()]);
  const destination = safeRedirectPath(next, "/account");
  if (actor) redirect(destination);

  return (
    <AuthShell
      title="Create an account"
      subtitle="Checkout is faster, orders are trackable, and your wishlist is kept."
      footer={
        <>
          Already have one? <AuthLink href={`/sign-in?next=${encodeURIComponent(destination)}`}>Sign in</AuthLink>
        </>
      }
    >
      <SignUpForm next={destination} />
    </AuthShell>
  );
}
