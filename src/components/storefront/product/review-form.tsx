"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitReviewAction } from "@/server/actions/reviews";

/** Review form. Ratings are radio inputs so keyboard and screen readers work. */
export function ReviewForm({
  productId,
  productSlug,
  signedIn,
  alreadyReviewed,
}: {
  productId: string;
  productSlug: string;
  signedIn: boolean;
  alreadyReviewed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <p className="text-[13px] text-muted">
        <Link href={`/sign-in?next=/product/${productSlug}`} className="underline underline-offset-4 hover:text-ink">
          Sign in
        </Link>{" "}
        to write a review.
      </p>
    );
  }

  if (alreadyReviewed || done) {
    return (
      <p role="status" className="text-[13px] text-success">
        {done
          ? "Thank you — your review has been sent for moderation."
          : "You have already reviewed this product."}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Write a review
      </Button>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    setPending(true);
    const result = await submitReviewAction({
      productId,
      productSlug,
      rating,
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    setPending(false);
    if (result.ok) setDone(true);
    else setError(result.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-soft">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer p-0.5">
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
                required
              />
              <span className="sr-only">{value} stars</span>
              <Star
                size={24}
                strokeWidth={1.4}
                onMouseEnter={() => setHovered(value)}
                className={cn(
                  "transition-colors",
                  (hovered || rating) >= value ? "fill-gold text-gold" : "text-line-strong",
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Headline (optional)" htmlFor="review-title">
        <Input id="review-title" name="title" maxLength={120} placeholder="Sums up your experience" />
      </Field>

      <Field
        label="Your review"
        htmlFor="review-body"
        hint="At least 20 characters. Reviews are checked before they appear."
      >
        <Textarea id="review-body" name="body" rows={5} required minLength={20} maxLength={4000} />
      </Field>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || rating === 0}>
          {pending ? "Sending…" : "Submit review"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
