"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Registration. Password strength is length-led, per current NIST guidance. */
export function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");

  const strength = scorePassword(password);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (password.length < 10) {
      setError("Please use a password of at least 10 characters.");
      return;
    }

    setPending(true);
    const result = await signUp.email({ name, email, password });
    setPending(false);

    if (result.error) {
      setError(
        result.error.status === 422 || result.error.message?.toLowerCase().includes("exist")
          ? "An account with that email address already exists. Try signing in instead."
          : "We could not create that account. Please check the details and try again.",
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} />
      </Field>

      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password" hint="At least 10 characters. A short phrase works well.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {password.length > 0 ? (
        <div aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-1 flex-1 ${index < strength.score ? strength.colour : "bg-line"}`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">{strength.label}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-[12px] leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <a href="/terms" className="underline underline-offset-4">
          terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-4">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}

/** Length-led scoring: variety helps, but length is what actually matters. */
function scorePassword(password: string): { score: number; label: string; colour: string } {
  if (password.length === 0) return { score: 0, label: "", colour: "bg-line" };
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 20) score += 1;
  if (/\d/.test(password) && /[a-zA-Z]/.test(password)) score += 1;

  const labels = ["Too short", "Acceptable", "Good", "Strong", "Very strong"];
  const colours = ["bg-danger", "bg-warning", "bg-warning", "bg-success", "bg-success"];
  return { score, label: labels[score], colour: colours[score] };
}
