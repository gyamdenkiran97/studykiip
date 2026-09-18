import type { Metadata } from "next";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links are valid for one hour and can only be used once."
        footer={<AuthLink href="/forgot-password">Request a new link</AuthLink>}
      >
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you have not used elsewhere.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
