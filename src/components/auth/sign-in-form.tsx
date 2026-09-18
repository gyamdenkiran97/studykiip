"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/**
 * Sign in.
 *
 * Failures are reported with one generic message whatever the cause, so the
 * form cannot be used to discover which addresses have accounts.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);

    const result = await signIn.email({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    setPending(false);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : "That email address and password do not match an account.",
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required aria-describedby="form-error" />
      </Field>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="block text-[13px] font-medium text-ink-soft">
            Password
          </label>
          <Link href="/forgot-password" className="text-[12.5px] text-muted underline underline-offset-4 hover:text-ink">
            Forgotten?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5"
        />
      </div>

      {error ? (
        <p id="form-error" role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
