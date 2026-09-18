"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/**
 * Password reset request.
 *
 * The confirmation is identical whether or not the address exists — otherwise
 * this form becomes an account-enumeration oracle.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    await requestPasswordReset({
      email: String(formData.get("email") ?? ""),
      redirectTo: "/reset-password",
    });
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="text-[14.5px] leading-relaxed text-ink-soft">
        If that address has an account with us, a reset link is on its way. The link is valid for one hour
        and can be used once.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
