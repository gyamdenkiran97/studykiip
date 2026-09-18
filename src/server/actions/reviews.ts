"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submitReview } from "../reviews";
import { toActionError, type ActionResult } from "../errors";
import { rateLimit, RATE_LIMITS } from "../rate-limit";
import { requireActor } from "../auth/session";
import { cuid } from "../validation/common";

const schema = z.object({
  productId: cuid,
  productSlug: z.string().max(200),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20).max(4000),
});

export async function submitReviewAction(input: unknown): Promise<ActionResult<{ pending: true }>> {
  try {
    const parsed = schema.parse(input);
    const actor = await requireActor();

    // Spam control: a handful of reviews an hour per account, not per IP, so a
    // shared network is not punished for one bad actor.
    const limit = await rateLimit(`review:${actor.id}`, RATE_LIMITS.review);
    if (!limit.success) {
      return { ok: false, code: "RATE_LIMITED", message: "You have submitted several reviews recently. Try again later." };
    }

    await submitReview({
      productId: parsed.productId,
      rating: parsed.rating,
      title: parsed.title,
      body: parsed.body,
    });

    revalidatePath(`/product/${parsed.productSlug}`);
    return { ok: true, data: { pending: true } };
  } catch (error) {
    return toActionError(error);
  }
}
