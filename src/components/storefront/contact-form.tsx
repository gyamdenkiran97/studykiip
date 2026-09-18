"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { sendContactMessageAction } from "@/server/actions/contact";

const TOPICS = ["An order", "A return or refund", "A product question", "Something else"];

/** Contact form. Server-validated and rate limited; no data leaves the site. */
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <div role="status" className="border border-success/30 bg-success/[0.06] px-5 py-4">
        <p className="font-display text-lg">Message received</p>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Thank you — we will reply within one working day, to the address you gave.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        setStatus("pending");

        const result = await sendContactMessageAction({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          topic: String(formData.get("topic") ?? ""),
          orderNumber: String(formData.get("orderNumber") ?? ""),
          message: String(formData.get("message") ?? ""),
        });

        if (result.ok) {
          setStatus("sent");
          return;
        }
        setStatus("idle");
        setError(result.message);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} />
        </Field>
        <Field label="Email address" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What is it about?" htmlFor="topic">
          <Select id="topic" name="topic" defaultValue={TOPICS[0]}>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order number (optional)" htmlFor="orderNumber">
          <Input id="orderNumber" name="orderNumber" maxLength={40} placeholder="KM-…" />
        </Field>
      </div>

      <Field label="Message" htmlFor="message">
        <Textarea id="message" name="message" rows={6} required minLength={10} maxLength={4000} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={status === "pending"}>
        {status === "pending" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
