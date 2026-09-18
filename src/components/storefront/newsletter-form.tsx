"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { subscribeToNewsletterAction } from "@/server/actions/newsletter";

/** Newsletter sign-up. Server-validated; the form never claims more than it does. */
export function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("pending");
    const result = await subscribeToNewsletterAction({ email: String(formData.get("email") ?? "") });
    if (result.ok) {
      setStatus("done");
      setMessage("Thank you — please confirm from the email we just sent.");
      event.currentTarget.reset();
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <div className="flex items-center border-b border-line-strong focus-within:border-ink">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 w-full bg-transparent text-sm placeholder:text-muted-soft focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "pending"}
          className="grid h-11 w-11 place-items-center text-ink transition-colors hover:text-clay disabled:opacity-50"
          aria-label="Subscribe to the newsletter"
        >
          <ArrowRight size={18} strokeWidth={1.6} />
        </button>
      </div>
      {message ? (
        <p role="status" className={status === "error" ? "text-[13px] text-danger" : "text-[13px] text-success"}>
          {message}
        </p>
      ) : (
        <p className="text-[12px] text-muted">
          Unsubscribe in one click. We never share your address.
        </p>
      )}
    </form>
  );
}
